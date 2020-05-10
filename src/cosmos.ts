import { SqlParameter } from '@azure/cosmos';
import { GraphQLCosmosRequest } from './context';
import { SqlBuilder } from './sql';

export const defaultOnQuery = ({ client, database, container, query, parameters }: GraphQLCosmosRequest) =>
    client.database(database).container(container).items.query({ query, parameters }).fetchAll();

export function createSqlQuery(
    whereExpressions: Array<{ property: string; operation: string; value: unknown; parameter: string }>,
    sortExpressions: Array<{ property: string; direction: string }>,
) {
    const fromAlias = `c`;
    const expressions = whereExpressions.map((expr) => {
        const operationMap: Record<string, string> = {
            '': `${fromAlias}.${expr.property} = ${expr.parameter}`,
            eq: `${fromAlias}.${expr.property} = ${expr.parameter}`,
            neq: `${fromAlias}.${expr.property} != ${expr.parameter}`,
            gt: `${fromAlias}.${expr.property} > ${expr.parameter}`,
            gte: `${fromAlias}.${expr.property} >= ${expr.parameter}`,
            lt: `${fromAlias}.${expr.property} < ${expr.parameter}`,
            lte: `${fromAlias}.${expr.property} <= ${expr.parameter}`,
            in: `ARRAY_CONTAINS(${expr.parameter}, ${fromAlias}.${expr.property})`,
            nin: `NOT ARRAY_CONTAINS(${expr.parameter}, ${fromAlias}.${expr.property})`,
            contains: `CONTAINS(${fromAlias}.${expr.property}, ${expr.parameter})`,
            ncontains: `NOT CONTAINS(${fromAlias}.${expr.property}, ${expr.parameter})`,
        };
        const sql: string = operationMap[expr.operation];
        const parameter: SqlParameter = { name: expr.parameter, value: expr.value as any };
        if (sql) {
            return { sql, parameter };
        } else {
            throw Error(`unknown expression in ${JSON.stringify(whereExpressions)}`);
        }
    });

    const sql = new SqlBuilder(fromAlias);
    for (const expr of expressions) {
        if (expr) {
            sql.where(expr.sql);
        }
    }

    for (const { property, direction } of sortExpressions) {
        if (direction === `ASC`) {
            sql.orderBy(`${fromAlias}.${property}`, `ASC`);
        } else if (direction === `DESC`) {
            sql.orderBy(`${fromAlias}.${property}`, `DESC`);
        } else {
            throw Error(`sort direction of ${property} must be ASC or DESC`);
        }
    }

    sql.orderBy(`${fromAlias}.id`, `ASC`);

    const parameters = expressions.map((x) => x?.parameter).filter((x): x is SqlParameter => !!x);

    return { sql, parameters };
}
