import { buildASTSchema, DocumentNode, GraphQLSchema } from 'graphql'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { GraphQLCosmosSchema } from '../1-graphql/1-directives'

export class CosmosSchemaDirectivesBuilder {
  buildASTSchema(typedefs: DocumentNode): GraphQLSchema {
    return buildASTSchema(this.mergeTypedefs(typedefs))
  }

  mergeTypedefs(typedefs: DocumentNode): DocumentNode {
    return mergeTypeDefs([GraphQLCosmosSchema.typeDefs, typedefs])
  }
}
