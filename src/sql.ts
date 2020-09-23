import { SqlParameter } from "@azure/cosmos";
import { DEFAULT_ID } from "./constants";
import { CosmosRequest } from "./intermediate/model";
import { SqlBuilder } from "./sql/builder";
import { isSqlOperation, sqlOp } from "./sql/op";

export interface ConvertToSql {
  sql: SqlBuilder;
  parameters: SqlParameter[];
}
export function convertToSql({
  columns: columnNames,
  where,
  sort,
}: CosmosRequest): ConvertToSql {
  const alias = `c`;

  const expressions = where.map((expr) => {
    if (isSqlOperation(expr.operation)) {
      const sql = sqlOp(alias, expr.property, expr.operation, expr.parameter);
      const parameter: SqlParameter = {
        name: expr.parameter,
        value: expr.value,
      };
      return { sql, parameter };
    } else {
      throw Error(`unknown operation in ${JSON.stringify(expr)}`);
    }
  });

  const sql = new SqlBuilder(alias);

  for (const columnName of columnNames) {
    sql.select(`${alias}.${columnName}`);
  }

  for (const expr of expressions) {
    if (expr) {
      sql.where(expr.sql);
    }
  }

  for (const { property, direction } of sort) {
    if (direction === `ASC`) {
      sql.orderBy(`${alias}.${property}`, `ASC`);
    } else if (direction === `DESC`) {
      sql.orderBy(`${alias}.${property}`, `DESC`);
    } else {
      throw Error(`sort direction of ${property} must be ASC or DESC`);
    }
  }

  sql.orderBy(`${alias}.${DEFAULT_ID}`, `ASC`);

  const parameters = expressions.map((x) => x.parameter);

  return { sql, parameters };
}
