import { IResolvers } from '@graphql-tools/utils'
import { defaultFieldResolver, getNamedType, GraphQLResolveInfo } from 'graphql'
import { MetaField, MetaType } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { defaultCosmosFieldResolver } from '../5-resolvers/default'
import { defaultCosmosResolveListByOurs } from '../5-resolvers/resolve-list-ours'
import { defaultCosmosResolveListRoot } from '../5-resolvers/resolve-list-root'
import { defaultCosmosResolveListByTheirs } from '../5-resolvers/resolve-list-theirs'
import { defaultCosmosResolveOneOurs } from '../5-resolvers/resolve-one-ours'
import { defaultCosmosResolveOneRoot } from '../5-resolvers/resolve-one-root'
import { defaultCosmosResolvePageByOurs } from '../5-resolvers/resolve-page-ours'
import { defaultCosmosResolvePageRoot } from '../5-resolvers/resolve-page-root'
import { defaultCosmosResolvePageByTheirs } from '../5-resolvers/resolve-page-theirs'
import { GraphQLCosmosFieldResolver } from '../5-resolvers/resolver'
import { defaultCosmosScalarFieldResolver } from '../5-resolvers/scalar'
import { SourceDescriptor } from '../5-resolvers/x-descriptors'
import { GraphQLCosmosConceptContext } from '../6-datasource/1-context'
import { withConsoleTraceMiddleware, withErrorMiddleware } from '../error'

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
    const fields = type.fields.map((f) => [f.fieldname, this.buildField(f, type)])
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

  buildField(field: MetaField, type: MetaType): GraphQLCosmosFieldResolver<unknown, GraphQLCosmosConceptContext> {
    const returnType = this.meta.type(field.returnTypename)

    if (field.fieldname === `id`) {
      return /*withConsoleTraceMiddleware*/ withErrorMiddleware(`default`, defaultFieldResolver)
    } else if (returnType?.cosmos && !type.cosmos && field.pagination && field.ours === null) {
      return /*withConsoleTraceMiddleware*/ withErrorMiddleware(`root-page`, defaultCosmosResolvePageRoot)
    } else if (returnType?.cosmos && !type.cosmos && field.returnMany && field.ours === null) {
      return /*withConsoleTraceMiddleware*/ withErrorMiddleware(`root-many`, defaultCosmosResolveListRoot)
    } else if (returnType?.cosmos && !type.cosmos && field.ours === null) {
      return /*withConsoleTraceMiddleware*/ withErrorMiddleware(`root-one`, defaultCosmosResolveOneRoot)
    } else if (returnType?.cosmos && field.pagination && field.theirs) {
      return /*withConsoleTraceMiddleware*/ withErrorMiddleware(`page-by-theirs`, defaultCosmosResolvePageByTheirs)
    } else if (returnType?.cosmos && field.pagination && field.ours) {
      return /*withConsoleTraceMiddleware*/ withErrorMiddleware(`page-by-ours`, defaultCosmosResolvePageByOurs)
    } else if (returnType?.cosmos && field.returnMany && field.theirs) {
      return /*withConsoleTraceMiddleware*/ withErrorMiddleware(`list-by-theirs`, defaultCosmosResolveListByTheirs)
    } else if (returnType?.cosmos && field.returnMany && field.ours) {
      return /*withConsoleTraceMiddleware*/ withErrorMiddleware(`list-by-ours`, defaultCosmosResolveListByOurs)
    } else if (returnType?.cosmos) {
      return /*withConsoleTraceMiddleware*/ withErrorMiddleware(`one-ours`, defaultCosmosResolveOneOurs)
    } else {
      return /*withConsoleTraceMiddleware*/ withErrorMiddleware(`column`, defaultCosmosFieldResolver)
    }
  }
}
