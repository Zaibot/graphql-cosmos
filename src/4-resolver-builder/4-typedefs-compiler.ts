import { IResolvers } from '@graphql-tools/utils'
import { DocumentNode } from 'graphql'
import { getGraphQLCosmosSchemaFromGraphQL } from '../2-meta/1-ast'
import { getMetaSchema, MetaSchema } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { CosmosResolverBuilder } from './1-resolver-map'
import { CosmosSchemaDirectivesBuilder } from './2-schema-with-directives'
import { CosmosTypeDefsTransformer } from './3-typedefs-transformer'

export class CosmosTypeDefsCompiler {
  metaSchema!: MetaSchema
  typeDefs!: DocumentNode
  resolvers!: IResolvers

  static fromTypeDefs(typedefs: DocumentNode, configureMetaTypes: (meta: MetaSchema) => void = () => {}) {
    // Extract meta schema
    const astSummary = getGraphQLCosmosSchemaFromGraphQL(typedefs)
    const metaSchema = getMetaSchema(astSummary)

    configureMetaTypes(metaSchema)

    const meta = new MetaIndex(metaSchema)

    // 1-CosmosResolverBuilder
    const resolverBuilder = new CosmosResolverBuilder(meta)
    const resolvers = resolverBuilder.buildTypes(meta.allTypes)

    // 2-CosmosSchemaDirectivesBuilder
    const schemaBuilder = new CosmosSchemaDirectivesBuilder()
    const schemaWithDirectives = schemaBuilder.mergeTypedefs(typedefs)

    // 3-CosmosSchemaTransformer
    const schemaTranformer = new CosmosTypeDefsTransformer(meta)
    const compiledSchema = schemaTranformer.transform(schemaWithDirectives)

    const r = new CosmosTypeDefsCompiler()
    r.metaSchema = metaSchema
    r.typeDefs = compiledSchema
    r.resolvers = resolvers
    return r
  }
}


