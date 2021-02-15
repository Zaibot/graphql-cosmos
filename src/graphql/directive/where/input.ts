import { GraphQLList, GraphQLScalarType, GraphQLSchema } from 'graphql'
import { SqlOp, SqlOperationList } from '../../../sql/op'
import { createOrGetWhereType } from '../../internal/schema'

export const inputWhere = (
  base: string,
  fields: Array<{
    name: string
    operations: Array<SqlOp>
    scalar: GraphQLScalarType
    fieldIsArray: boolean
  }>,
  schema: GraphQLSchema
) => {
  const allOperations = fields.flatMap((field) => field.operations.map((operation) => ({ ...field, operation })))
  const whereFields = Object.fromEntries(
    allOperations.map(({ name, operation, scalar, fieldIsArray }) => [
      `${name}_${operation}`,
      {
        type: isInOrNin(operation) && !fieldIsArray ? new GraphQLList(scalar) : scalar,
        extensions: { __operation: operation },
      },
    ])
  )
  const filterType = createOrGetWhereType(`${base}Where`, whereFields, schema)
  return filterType
}

function isInOrNin(operation: SqlOp) {
  return operation === SqlOperationList.in || operation === SqlOperationList.nin
}
