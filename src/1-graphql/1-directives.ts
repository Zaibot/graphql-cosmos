import { buildASTSchema, parse, print } from 'graphql'

const typeDefs = parse(`
  directive @cosmos(database: String, container: String, ours: String, theirs: String, pagination: String) on OBJECT | FIELD_DEFINITION
  directive @where(op: String, ours: String) on FIELD_DEFINITION
  directive @sort(ours: String) on FIELD_DEFINITION
`)

export const GraphQLCosmosSchema = { typeDefs, schemaSource: print(typeDefs), schema: buildASTSchema(typeDefs) }
