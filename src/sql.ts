import { DEFAULT } from './constants'
import { CosmosRequest } from './intermediate/model'
import { SqlBuilder } from './sql/builder'
import { isSqlOperation, sqlOp, SqlOpParameter } from './sql/op'

export interface ConvertToSql {
  sql: SqlBuilder
  parameters: Array<SqlOpParameter>
}
export function convertToSql({ type, columns: columnNames, where, sort }: CosmosRequest): ConvertToSql {
  const alias = `c`

  const expressions = where.map((expr) => {
    if (isSqlOperation(expr.operation)) {
      const sql = sqlOp(alias, expr.property, expr.operation, expr.parameter)
      const parameter: SqlOpParameter = {
        name: expr.parameter,
        value: expr.value,
      }
      return { sql, parameter }
    } else {
      throw Error(`unknown operation in ${JSON.stringify(expr)}`)
    }
  })

  const sql = new SqlBuilder(alias)

  if (type === `count`) {
    sql.value().select(`COUNT(1)`)
  } else {
    for (const columnName of columnNames) {
      sql.select(`${alias}.${columnName}`)
    }
  }

  for (const expr of expressions) {
    if (expr) {
      sql.where(expr.sql)
    }
  }

  if (type === `count`) {
    // Skip ordering when counting
  } else if (sort) {
    for (const { property, direction } of sort) {
      if (direction === `ASC`) {
        sql.orderBy(`${alias}.${property}`, `ASC`)
      } else if (direction === `DESC`) {
        sql.orderBy(`${alias}.${property}`, `DESC`)
      } else {
        throw Error(`sort direction of ${property} must be ASC or DESC`)
      }
    }

    sql.orderBy(`${alias}.${DEFAULT.ID}`, `ASC`)
  }

  const parameters = expressions.map((x) => x.parameter)

  return { sql, parameters }
}
