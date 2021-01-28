import { GraphQLInt, GraphQLSchema } from 'graphql'
import { createOrGetWhereType } from '../../internal/schema'

export const inputSort = (base: string, fields: Array<{ name: string }>, schema: GraphQLSchema) => {
  const sortFields = Object.fromEntries(
    fields.flatMap(({ name }) => [
      [`${name}_ASC`, { type: GraphQLInt }],
      [`${name}_DESC`, { type: GraphQLInt }],
    ])
  )
  const sortType = createOrGetWhereType(`${base}Sort`, sortFields, schema)
  return sortType
}
