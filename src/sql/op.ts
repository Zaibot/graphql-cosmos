export enum SqlOperationScalar {
  eq = 'eq',
  neq = 'neq',
  gr = 'gt',
  gte = 'gte',
  lt = 'lt',
  lte = 'lte',
  contains = 'contains',
  ncontains = 'ncontains',
}
export enum SqlOperationList {
  in = 'in',
  nin = 'nin',
}
export type SqlOpScalar = string | boolean | number | Array<SqlOpScalar>
export type SqlOpParameter = { name: string; value: SqlOpScalar }
export type SqlOp = SqlOperationScalar | SqlOperationList
export const isSqlOperation = (op: unknown): op is SqlOp =>
  Object.keys(SqlOperationScalar).includes(String(op)) || Object.keys(SqlOperationList).includes(String(op))

export const sqlOp = (alias: string, property: string, operation: SqlOp, parameter: string) => {
  const operationMap: Record<SqlOp, string> = {
    eq: `${alias}.${property} = ${parameter}`,
    neq: `${alias}.${property} != ${parameter}`,
    gt: `${alias}.${property} > ${parameter}`,
    gte: `${alias}.${property} >= ${parameter}`,
    lt: `${alias}.${property} < ${parameter}`,
    lte: `${alias}.${property} <= ${parameter}`,
    in: `ARRAY_CONTAINS(${parameter}, ${alias}.${property})`,
    nin: `NOT ARRAY_CONTAINS(${parameter}, ${alias}.${property})`,
    contains: `CONTAINS(${alias}.${property}, ${parameter})`,
    ncontains: `NOT CONTAINS(${alias}.${property}, ${parameter})`,
  }
  return operationMap[operation]
}
