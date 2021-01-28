import { GraphQLSchema } from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { GraphQLCosmosSchema } from './graphql/directive/schema'

export const preprocessSchema = (
  schema: GraphQLSchema,
  directives: Record<string, typeof SchemaDirectiveVisitor> = GraphQLCosmosSchema.schemaDirectives
): GraphQLSchema => {
  const extended = new GraphQLSchema(schema.toConfig())
  SchemaDirectiveVisitor.visitSchemaDirectives(extended, directives)

  const cleaned = extended.toConfig()
  cleaned.directives = cleaned.directives.filter((t) => !Object.keys(directives).includes(t.name))

  const finished = new GraphQLSchema(cleaned)
  return finished
}
