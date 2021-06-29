import { buildASTSchema, DocumentNode } from 'graphql'
import { mergeTypeDefs } from 'graphql-tools'
import { GraphQLCosmosSchema } from '../1-graphql/1-directives'

export class CosmosSchemaDirectivesBuilder {
  buildASTSchema(typedefs: DocumentNode) {
    return buildASTSchema(this.mergeTypedefs(typedefs))
  }

  mergeTypedefs(typedefs: DocumentNode): DocumentNode {
    return mergeTypeDefs([GraphQLCosmosSchema.typeDefs, typedefs])
  }
}
