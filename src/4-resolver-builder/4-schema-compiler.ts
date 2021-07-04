import { getDocumentNodeFromSchema, IResolvers } from '@graphql-tools/utils'
import { GraphQLSchema } from 'graphql'
import { getGraphQLCosmosSchemaFromGraphQL } from '../2-meta/1-ast'
import { getMetaSchema, MetaSchema } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { CosmosResolverBuilder } from './1-resolver-map'
import { CosmosSchemaDirectivesBuilder } from './2-schema-with-directives'
import { CosmosSchemaTransformer } from './3-schema-transformer'

export class CosmosSchemaCompiler {
  metaSchema!: MetaSchema
  schema!: GraphQLSchema
  resolvers!: IResolvers

  static fromSchema(schema: GraphQLSchema, configureMetaTypes: (meta: MetaSchema) => void = () => {}) {
    const typedefs = getDocumentNodeFromSchema(schema)

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
    const schemaWithDirectives = schemaBuilder.buildASTSchema(typedefs)

    // 3-CosmosSchemaTransformer
    const schemaTranformer = new CosmosSchemaTransformer(meta)
    const compiledSchema = schemaTranformer.transform(schemaWithDirectives)

    const r = new CosmosSchemaCompiler()
    r.metaSchema = metaSchema
    r.schema = compiledSchema
    r.resolvers = resolvers
    return r
  }
}
