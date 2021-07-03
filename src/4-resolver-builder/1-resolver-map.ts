import { IResolvers } from '@graphql-tools/utils'
import { defaultFieldResolver, getNamedType, GraphQLResolveInfo } from 'graphql'
import { MetaField, MetaType } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { defaultCosmosResolveColumnOurs } from '../5-resolvers/resolve-column'
import { defaultCosmosResolveListByOurs } from '../5-resolvers/resolve-list-ours'
import { defaultCosmosResolveListRoot } from '../5-resolvers/resolve-list-root'
import { defaultCosmosResolveListByTheirs } from '../5-resolvers/resolve-list-theirs'
import { defaultCosmosResolveOneOurs } from '../5-resolvers/resolve-one-ours'
import { defaultCosmosResolveOneRoot } from '../5-resolvers/resolve-one-root'
import { defaultCosmosResolvePageByOurs } from '../5-resolvers/resolve-page-ours'
import { defaultCosmosResolvePageRoot } from '../5-resolvers/resolve-page-root'
import { defaultCosmosResolvePageByTheirs } from '../5-resolvers/resolve-page-theirs'
import { GraphQLCosmosFieldResolver } from '../5-resolvers/resolver'
import { SourceDescriptor } from '../5-resolvers/x-descriptors'
import { GraphQLCosmosConceptContext } from '../6-datasource/1-context'
import { withErrorMiddleware } from '../error'

export interface CosmosResolverPlugin {
  (field: MetaField, type: MetaType, meta: MetaIndex, next: () => GraphQLCosmosFieldResolver<unknown, GraphQLCosmosConceptContext> | null): GraphQLCosmosFieldResolver<unknown, GraphQLCosmosConceptContext> | null | undefined
}

export namespace DefaultResolver {
  export const ColumnId: CosmosResolverPlugin = (field) => {
    if (field.fieldname === `id`) {
      return withErrorMiddleware(`default`, defaultFieldResolver)
    }
  }

  export const PageRoot: CosmosResolverPlugin = (field, type, meta, next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && !type.cosmos && field.pagination && field.ours === null && field.theirs === null) {
      return withErrorMiddleware(`root-page`, defaultCosmosResolvePageRoot)
    }
  }

  export const ListRoot: CosmosResolverPlugin = (field, type, meta, next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && !type.cosmos && field.returnMany && field.ours === null && field.theirs === null) {
      return withErrorMiddleware(`root-many`, defaultCosmosResolveListRoot)
    }
  }

  export const OneRoot: CosmosResolverPlugin = (field, type, meta, next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && !type.cosmos && field.ours === null && field.theirs === null) {
      return withErrorMiddleware(`root-one`, defaultCosmosResolveOneRoot)
    }
  }

  export const PageByTheirs: CosmosResolverPlugin = (field, type, meta, next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && field.pagination && field.theirs) {
      return withErrorMiddleware(`page-by-theirs`, defaultCosmosResolvePageByTheirs)
    }
  }

  export const PageByOurs: CosmosResolverPlugin = (field, type, meta, next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && field.pagination && field.ours) {
      return withErrorMiddleware(`page-by-ours`, defaultCosmosResolvePageByOurs)
    }
  }

  export const ListByTheirs: CosmosResolverPlugin = (field, type, meta, next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && field.returnMany && field.theirs) {
      return withErrorMiddleware(`list-by-theirs`, defaultCosmosResolveListByTheirs)
    }
  }

  export const ListByOurs: CosmosResolverPlugin = (field, type, meta, next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && field.returnMany && field.ours) {
      return withErrorMiddleware(`list-by-ours`, defaultCosmosResolveListByOurs)
    }
  }

  export const OneOurs: CosmosResolverPlugin = (field, type, meta, next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos) {
      return withErrorMiddleware(`one-ours`, defaultCosmosResolveOneOurs)
    }
  }

  export const ColumnOurs: CosmosResolverPlugin = (field, type, meta, next) => {
    if (type.cosmos) {
      return withErrorMiddleware(`column`, defaultCosmosResolveColumnOurs)
    }
  }
}

export const CommosResolverDefaults: CosmosResolverPlugin[] = [
  DefaultResolver.ColumnId,
  DefaultResolver.PageRoot,
  DefaultResolver.ListRoot,
  DefaultResolver.OneRoot,
  DefaultResolver.PageByTheirs,
  DefaultResolver.PageByOurs,
  DefaultResolver.ListByTheirs,
  DefaultResolver.ListByOurs,
  DefaultResolver.OneOurs,
  DefaultResolver.ColumnOurs,
]

export class CosmosResolverBuilder {
  meta: MetaIndex
  builders: CosmosResolverPlugin[]

  constructor(meta: MetaIndex, builders: CosmosResolverPlugin[] = CommosResolverDefaults) {
    this.meta = meta
    this.builders = builders
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
      return function __resolveReference(parent: Record<string, unknown>, { dataSources }: GraphQLCosmosConceptContext, info: GraphQLResolveInfo) {
        const type = dataSources.graphqlCosmos.meta.requireType(getNamedType(info.returnType).name)
        const database = type.database ?? fail(`requires database in meta type`)
        const container = type.container ?? fail(`requires container in meta type`)
        const id = Object(parent)[`id`] ?? fail(`requires id in parent`)
        return SourceDescriptor.withDescriptor({ id }, dataSources.graphqlCosmos.refSingle(type.typename, database, container, id))
      }
    }
  }

  buildField(field: MetaField, parentType: MetaType): GraphQLCosmosFieldResolver<unknown, GraphQLCosmosConceptContext> | null {
    function makePlugin([plugin, ...remainder]: CosmosResolverPlugin[], field: MetaField, type: MetaType, meta: MetaIndex): GraphQLCosmosFieldResolver<unknown, GraphQLCosmosConceptContext> | null | undefined {
      if (!plugin) {
        return undefined
      }
      const resolver = plugin(field, type, meta, () => {
        return makePlugin(remainder, field, type, meta) ?? null
      })
      if (resolver === undefined) {
        return makePlugin(remainder, field, type, meta)
      }
      return resolver
    }

    const resolver = makePlugin(this.builders, field, parentType, this.meta) ?? null
    return resolver
  }
}
