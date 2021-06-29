import { IResolvers } from '@graphql-tools/utils'
import { defaultFieldResolver, getNamedType, GraphQLResolveInfo } from 'graphql'
import { MetaField, MetaType } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { defaultCosmosObjectFieldResolver } from '../5-resolvers/object'
import { defaultCosmosPageFieldResolver } from '../5-resolvers/page'
import { GraphQLCosmosFieldResolver } from '../5-resolvers/resolver'
import { defaultCosmosRootFieldResolver } from '../5-resolvers/root'
import { defaultCosmosScalarFieldResolver } from '../5-resolvers/scalar'
import { SourceDescriptor } from '../5-resolvers/x-descriptors'
import { GraphQLCosmosConceptContext } from '../6-datasource/1-context'
import { withErrorMiddleware } from '../error'

export class CosmosResolverBuilder {
  meta: MetaIndex

  constructor(meta: MetaIndex) {
    this.meta = meta
  }

  buildTypes(types: MetaType[]): IResolvers<unknown, GraphQLCosmosConceptContext> {
    return Object.fromEntries(types.map((t) => [t.typename, this.buildFields(t)]))
  }

  buildFields(type: MetaType): IResolvers<unknown, GraphQLCosmosConceptContext> {
    const resolveReference = this.buildResolveReference(type)
    const fields = type.fields.map((f) => [f.fieldname, this.buildField(f)])
    return Object.fromEntries([[`__resolveReference`, resolveReference], ...fields].filter(([_, y]) => y))
  }

  buildResolveReference(type: MetaType) {
    if (type.database || type.container) {
      return function __resolveReference(
        parent: Record<string, unknown>,
        { dataSources }: GraphQLCosmosConceptContext,
        info: GraphQLResolveInfo
      ) {
        const type = dataSources.graphqlCosmos.meta.requireType(getNamedType(info.returnType).name)
        const database = type.database ?? fail(`requires database in meta type`)
        const container = type.container ?? fail(`requires container in meta type`)
        const id = Object(parent)[`id`] ?? fail(`requires id in parent`)
        return SourceDescriptor.withDescriptor(
          { id },
          dataSources.graphqlCosmos.refSingle(type.typename, database, container, id)
        )
      }
    }
  }

  buildField(field: MetaField): GraphQLCosmosFieldResolver<unknown, GraphQLCosmosConceptContext> {
    if (field.fieldname === `id`) {
      return defaultFieldResolver
    }
    switch (field.kind) {
      case 'embedded':
        return this.meta.type(field.returnTypename)
          ? withErrorMiddleware(`defaultCosmosScalarFieldResolver`, defaultCosmosObjectFieldResolver)
          : withErrorMiddleware(`defaultCosmosScalarFieldResolver`, defaultCosmosScalarFieldResolver)
      case 'many-ours':
        return withErrorMiddleware(`defaultCosmosScalarFieldResolver`, defaultCosmosPageFieldResolver)
      case 'many-theirs':
        return withErrorMiddleware(`defaultCosmosScalarFieldResolver`, defaultCosmosPageFieldResolver)
      case 'one-ours':
        return this.meta.type(field.returnTypename)
          ? withErrorMiddleware(`defaultCosmosScalarFieldResolver`, defaultCosmosObjectFieldResolver)
          : withErrorMiddleware(`defaultCosmosScalarFieldResolver`, defaultCosmosScalarFieldResolver)
      case 'one-theirs':
        return withErrorMiddleware(`defaultCosmosScalarFieldResolver`, defaultCosmosObjectFieldResolver)
      case 'many-root':
        return withErrorMiddleware(`defaultCosmosScalarFieldResolver`, defaultCosmosRootFieldResolver)
      default:
        throw Error(`unexpected field type: ${field.kind}`)
    }
  }
}
