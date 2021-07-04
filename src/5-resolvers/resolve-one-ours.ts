import { GraphQLCosmosPageInput } from '../4-resolver-builder/3-typedefs-transformer'
import { failql } from '../typescript'
import { parseInputWhere } from './input-args'
import { wrapSingleSourceDescriptor } from './internals/utils'
import { defaultCosmosResolveColumnOurs } from './resolve-column'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolveOneOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  // const parentType = context.dataSources.graphqlCosmos.meta.requireType(info.parentType.name)
  // const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  // const returnType = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)

  // const current = (await defaultCosmosResolveColumnOurs(parent, args, context, info)) ?? null
  // if (current == null) {
  //   return null
  // }

  // const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
  // const where = parseInputWhere({
  //   and: [
  //     pageArgs.where ?? {},
  //     Array.isArray(current)
  //       ? { [`${field.theirs ?? `id`}_in`]: current }
  //       : { [`${field.theirs ?? `id`}_eq`]: current },
  //   ],
  // })

  // const database = field.database ?? parentType.database ?? failql(`requires database`, info)
  // const container = field.container ?? parentType.container ?? failql(`requires container`, info)

  // const prefetch = context.dataSources.graphqlCosmos.prefetchOfObject(info)

  // const query = context.dataSources.graphqlCosmos.buildQuery({
  //   database,
  //   container,
  //   context,
  //   cursor: null,
  //   fields: [`id`].concat(prefetch),
  //   origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
  //   sort: [],
  //   where,
  //   typename: returnType.typename,
  //   limit: 2,
  // })

  // const feed = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
  // if (feed.resources.length > 1) {
  //   failql(`defaultCosmosResolveOneRoot expects a single result`, info)
  // }

  // return feed.resources.map(wrapSingleSourceDescriptor(returnType.typename, database, container))[0]

  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const type = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)
  const current = await defaultCosmosResolveColumnOurs(parent, args, context, info)

  if (field.returnMany) {
    const container = field.container ?? type.container ?? failql(`requires container`, info)
    const database = field.database ?? type.database ?? failql(`requires database`, info)
    return current
      ?.filter(Boolean)
      .map((id: any) => context.dataSources.graphqlCosmos.single(type.typename, database, container, { id }))
  } else {
    if (current) {
      const container = field.container ?? type.container ?? failql(`requires container`, info)
      const database = field.database ?? type.database ?? failql(`requires database`, info)
      return context.dataSources.graphqlCosmos.single(type.typename, database, container, { id: current })
    }
  }
}
