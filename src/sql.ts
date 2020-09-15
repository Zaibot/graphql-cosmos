import { SqlParameter } from '@azure/cosmos';
import { CosmosRequest } from './intermediate/model';
import { SqlBuilder } from './sql/builder';
import { isSqlOperation, sqlOp } from './sql/op';

export function convertToSql({ where, sort }: CosmosRequest) {
    const alias = `c`;

    const expressions = where.map((expr) => {
        if (isSqlOperation(expr.operation)) {
            const sql = sqlOp(alias, expr.property, expr.operation, expr.parameter);
            const parameter: SqlParameter = { name: expr.parameter, value: expr.value };
            return { sql, parameter };
        } else {
            throw Error(`unknown operation in ${JSON.stringify(expr)}`);
        }
    });

    const sql = new SqlBuilder(alias);
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

    sql.orderBy(`${alias}.id`, `ASC`);

    const parameters = expressions.map((x) => x?.parameter).filter((x): x is SqlParameter => !!x);

    return { sql, parameters };
}
