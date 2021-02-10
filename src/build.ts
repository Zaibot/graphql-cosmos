import * as GraphQL from 'graphql'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { GraphQLCosmosSchema } from './graphql/directive/schema'
import { buildCosmosFieldResolverSchema as applyCosmosDefaultFieldResolvers } from './graphql/resolver/default'

export const buildCosmosSchema = (
  schema: GraphQL.GraphQLSchema,
  directives: Record<string, typeof SchemaDirectiveVisitor> = GraphQLCosmosSchema.schemaDirectives
): GraphQL.GraphQLSchema => {
  const extended = new GraphQL.GraphQLSchema(schema.toConfig())
  SchemaDirectiveVisitor.visitSchemaDirectives(extended, directives)
  applyCosmosDefaultFieldResolvers(schema)

  const cleaned = extended.toConfig()
  cleaned.directives = cleaned.directives.filter((t) => !Object.keys(directives).includes(t.name))

  const finished = new GraphQL.GraphQLSchema(cleaned)
  return finished
}

export const buildCosmosASTSchema = (
  typeDefs: GraphQL.DocumentNode,
  directives: Record<string, typeof SchemaDirectiveVisitor> = GraphQLCosmosSchema.schemaDirectives
): GraphQL.GraphQLSchema => {
  return buildCosmosSchema(
    GraphQL.buildASTSchema(GraphQL.concatAST([typeDefs, GraphQLCosmosSchema.typeDefs])),
    directives
  )
}
