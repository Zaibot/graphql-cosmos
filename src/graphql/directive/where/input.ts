import { GraphQLScalarType, GraphQLSchema } from 'graphql'
import { SqlOp } from '../../../sql/op'
import { createOrGetWhereType } from '../../internal/schema'

export const inputWhere = (
  base: string,
  fields: Array<{
    name: string
    operations: Array<SqlOp>
    scalar: GraphQLScalarType
  }>,
  schema: GraphQLSchema
) => {
  const allOperations = fields.flatMap((field) => field.operations.map((operation) => ({ ...field, operation })))
  const whereFields = Object.fromEntries(
    allOperations.map(({ name, operation, scalar }) => [
      `${name}_${operation}`,
      { type: scalar, extensions: { __operation: operation } },
    ])
  )
  const filterType = createOrGetWhereType(`${base}Where`, whereFields, schema)
  return filterType
}
