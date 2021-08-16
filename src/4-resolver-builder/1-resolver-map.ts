import { IResolvers } from '@graphql-tools/utils'
import { defaultFieldResolver, GraphQLResolveInfo } from 'graphql'
import { MetaField, MetaType } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { defaultCosmosResolveColumnOurs } from '../5-resolvers/resolve-column'
import { defaultCosmosResolveExternalListOurs } from '../5-resolvers/resolve-list-external'
import { defaultCosmosResolveListByOurs } from '../5-resolvers/resolve-list-ours'
import { defaultCosmosResolveListRoot } from '../5-resolvers/resolve-list-root'
import { defaultCosmosResolveListByTheirs } from '../5-resolvers/resolve-list-theirs'
import { defaultCosmosResolveExternalOneOurs } from '../5-resolvers/resolve-one-external'
import { defaultCosmosResolveOneOurs } from '../5-resolvers/resolve-one-ours'
import { defaultCosmosResolveOneRoot } from '../5-resolvers/resolve-one-root'
import { defaultCosmosResolveOneByTheirs } from '../5-resolvers/resolve-one-theirs'
import { defaultCosmosResolvePageByOurs } from '../5-resolvers/resolve-page-ours'
import { defaultCosmosResolvePageRoot } from '../5-resolvers/resolve-page-root'
import { defaultCosmosResolvePageByTheirs } from '../5-resolvers/resolve-page-theirs'
import { GraphQLCosmosFieldResolver } from '../5-resolvers/resolver'
import { GraphQLCosmosConceptContext, requireGraphQLCosmos } from '../6-datasource/1-context'
import { withErrorMiddleware } from '../error'
import { failql } from '../typescript'

export interface CosmosResolverPlugin {
  (field: MetaField, type: MetaType, meta: MetaIndex, next: () => GraphQLCosmosFieldResolver<unknown, GraphQLCosmosConceptContext> | null): GraphQLCosmosFieldResolver<unknown, GraphQLCosmosConceptContext> | null | undefined
}

export namespace DefaultResolver {
  export const ColumnId: CosmosResolverPlugin = (field) => {
    if (field.fieldname === `id`) {
      return withErrorMiddleware(`default`, defaultFieldResolver)
    }
  }

  export const PageRoot: CosmosResolverPlugin = (field, type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && !type.cosmos && field.pagination && field.ours === null && field.theirs === null) {
      return withErrorMiddleware(`root-page`, defaultCosmosResolvePageRoot)
    }
  }

  export const ListRoot: CosmosResolverPlugin = (field, type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && !type.cosmos && field.returnMany && field.ours === null && field.theirs === null) {
      return withErrorMiddleware(`root-many`, defaultCosmosResolveListRoot)
    }
  }

  export const OneRoot: CosmosResolverPlugin = (field, type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && !type.cosmos && field.ours === null && field.theirs === null) {
      return withErrorMiddleware(`root-one`, defaultCosmosResolveOneRoot)
    }
  }

  export const PageByTheirs: CosmosResolverPlugin = (field, _type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && field.pagination && field.theirs) {
      return withErrorMiddleware(`page-by-theirs`, defaultCosmosResolvePageByTheirs)
    }
  }

  export const PageByOurs: CosmosResolverPlugin = (field, _type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && field.pagination && field.ours) {
      return withErrorMiddleware(`page-by-ours`, defaultCosmosResolvePageByOurs)
    }
  }

  export const ListByTheirs: CosmosResolverPlugin = (field, _type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && field.returnMany && field.theirs) {
      return withErrorMiddleware(`list-by-theirs`, defaultCosmosResolveListByTheirs)
    }
  }

  export const ListByOurs: CosmosResolverPlugin = (field, _type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && field.returnMany && field.ours) {
      return withErrorMiddleware(`list-by-ours`, defaultCosmosResolveListByOurs)
    }
  }

  export const ComsoslessListByOurs: CosmosResolverPlugin = (field, _type, meta, _next) => {
    if (field.cosmos && field.returnMany && field.ours) {
      return withErrorMiddleware(`list-by-ours`, defaultCosmosResolveListByOurs)
    }
  }

  export const OneOurs: CosmosResolverPlugin = (field, _type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && !field.returnMany && field.theirs === null) {
      return withErrorMiddleware(`one-ours`, defaultCosmosResolveOneOurs)
    }
  }

  export const ComsoslessOneOurs: CosmosResolverPlugin = (field, _type, meta, _next) => {
    if (field.cosmos && !field.returnMany && field.theirs === null) {
      return withErrorMiddleware(`one-ours`, defaultCosmosResolveOneOurs)
    }
  }

  export const OneTheirs: CosmosResolverPlugin = (field, _type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.cosmos && field.cosmos && !field.returnMany && field.theirs !== null) {
      return withErrorMiddleware(`one-ours`, defaultCosmosResolveOneByTheirs)
    }
  }

  export const ColumnOurs: CosmosResolverPlugin = (_field, type, _meta, _next) => {
    if (type.cosmos) {
      return withErrorMiddleware(`column-ours`, defaultCosmosResolveColumnOurs)
    }
  }

  export const ExternalTypeTheirs: CosmosResolverPlugin = (field, _type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.external && field.theirs !== null) {
      if (field.returnMany) {
        return withErrorMiddleware(`external-list-by-theirs`, defaultCosmosResolveExternalListOurs)
      } else {
        return withErrorMiddleware(`external-one-by-theirs`, defaultCosmosResolveExternalOneOurs)
      }
    }
  }

  export const ExternalTypeOurs: CosmosResolverPlugin = (field, _type, meta, _next) => {
    const returnType = meta.type(field.returnTypename)
    if (returnType?.external && field.theirs === null) {
      if (field.returnMany) {
        return withErrorMiddleware(`external-list-by-ours`, defaultCosmosResolveExternalListOurs)
      } else {
        return withErrorMiddleware(`external-one-by-ours`, defaultCosmosResolveExternalOneOurs)
      }
    }
  }
}

export const CommosResolverDefaults: CosmosResolverPlugin[] = [
  DefaultResolver.ExternalTypeOurs,
  DefaultResolver.ExternalTypeTheirs,
  DefaultResolver.ColumnId,
  DefaultResolver.PageRoot,
  DefaultResolver.ListRoot,
  DefaultResolver.OneRoot,
  DefaultResolver.PageByTheirs,
  DefaultResolver.PageByOurs,
  DefaultResolver.ListByTheirs,
  DefaultResolver.ListByOurs,
  DefaultResolver.OneOurs,
  DefaultResolver.OneTheirs,
  DefaultResolver.ColumnOurs,
  DefaultResolver.ComsoslessOneOurs,
  DefaultResolver.ComsoslessListByOurs,
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
      return function __resolveReference(parent: Record<string, unknown>, context: GraphQLCosmosConceptContext, info: GraphQLResolveInfo) {
        const database = type.database ?? failql(`requires database in meta type`, info)
        const container = type.container ?? failql(`requires container in meta type`, info)
        Object(parent)[`id`] ?? failql(`requires id in parent`, info)
        return requireGraphQLCosmos(context).single(type.typename, database, container, parent as { id: string })
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
