import { IResolvers } from '@graphql-tools/utils'
import { defaultFieldResolver, getNamedType, GraphQLResolveInfo } from 'graphql'
import { MetaField, MetaType } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { defaultCosmosObjectFieldResolver } from '../5-resolvers/object'
import { defaultCosmosResolveListByOurs } from '../5-resolvers/resolve-list-ours'
import { defaultCosmosResolveListRoot } from '../5-resolvers/resolve-list-root'
import { defaultCosmosResolveListByTheirs } from '../5-resolvers/resolve-list-theirs'
import { defaultCosmosResolveOneRoot } from '../5-resolvers/resolve-one-root'
import { defaultCosmosResolvePageByOurs } from '../5-resolvers/resolve-page-ours'
import { defaultCosmosResolvePageRoot } from '../5-resolvers/resolve-page-root'
import { defaultCosmosResolvePageByTheirs } from '../5-resolvers/resolve-page-theirs'
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

    if (!type.cosmos) {
      if (field.pagination) {
        return withErrorMiddleware(`root-page`, defaultCosmosResolvePageRoot)
      } else if (field.returnMany) {
        return withErrorMiddleware(`root-many`, defaultCosmosResolveListRoot)
      } else {
        return withErrorMiddleware(`root-one`, defaultCosmosResolveOneRoot)
      }
    }

    if (field.fieldname === `id`) {
      return withErrorMiddleware(`default`, defaultFieldResolver)
    } else if (returnType && field.pagination && field.theirs) {
      return withErrorMiddleware(`page-by-theirs`, defaultCosmosResolvePageByTheirs)
    } else if (returnType && field.pagination && field.ours) {
      return withErrorMiddleware(`page-by-ours`, defaultCosmosResolvePageByOurs)
    } else if (returnType && field.returnMany && field.theirs) {
      return withErrorMiddleware(`list-by-theirs`, defaultCosmosResolveListByTheirs)
    } else if (returnType && field.returnMany && field.ours) {
      return withErrorMiddleware(`list-by-ours`, defaultCosmosResolveListByOurs)
    } else if (returnType) {
      return withErrorMiddleware(`one`, defaultCosmosObjectFieldResolver)
    } else {
      return withErrorMiddleware(`scalar`, defaultCosmosScalarFieldResolver)
    }

    throw Error(`no return type for: ${type.typename}.${field.fieldname}`)

    // switch (field.kind) {
    //   case 'embedded':
    //     return this.meta.type(field.returnTypename)
    //       ? withErrorMiddleware(`defaultCosmosObjectFieldResolver`, defaultCosmosObjectFieldResolver)
    //       : withErrorMiddleware(`defaultCosmosScalarFieldResolver`, defaultCosmosScalarFieldResolver)
    //   case 'many-ours':
    //     return withErrorMiddleware(`defaultCosmosPageFieldResolver`, defaultCosmosPageFieldResolver)
    //   case 'many-theirs':
    //     return withErrorMiddleware(`defaultCosmosPageFieldResolver`, defaultCosmosPageFieldResolver)
    //   case 'one-ours':
    //     return this.meta.type(field.returnTypename)
    //       ? withErrorMiddleware(`defaultCosmosObjectFieldResolver`, defaultCosmosObjectFieldResolver)
    //       : withErrorMiddleware(`defaultCosmosScalarFieldResolver`, defaultCosmosScalarFieldResolver)
    //   case 'one-theirs':
    //     return withErrorMiddleware(`defaultCosmosObjectFieldResolver`, defaultCosmosObjectFieldResolver)
    //   case 'one-root':
    //     return withErrorMiddleware(`defaultCosmosRootFieldResolver`, defaultCosmosRootFieldResolver)
    //   case 'many-root':
    //     return withErrorMiddleware(`defaultCosmosRootFieldResolver`, defaultCosmosRootFieldResolver)
    //   default:
    // }
  }
}
