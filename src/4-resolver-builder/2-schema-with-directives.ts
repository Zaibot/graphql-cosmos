import { DocumentNode } from 'graphql'
import { mergeTypeDefs } from 'graphql-tools'
import { GraphQLCosmosSchema } from '../1-graphql/1-directives'

export class CosmosSchemaDirectivesBuilder {
  mergeTypedefs(typedefs: DocumentNode): DocumentNode {
    return mergeTypeDefs([GraphQLCosmosSchema.typeDefs, typedefs])
  }
}
