import { getObjectId } from '../object-id'
import { failql } from '../typescript'
import { defaultCosmosResolveColumnOurs } from './resolve-column'
import { GraphQLCosmosFieldResolver } from './resolver'

export const defaultCosmosResolveOneOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  // const parentType = graphqlCosmos.meta.requireType(info.parentType.name)
  // const field = graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  // const returnType = graphqlCosmos.meta.requireType(field.returnTypename)

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

  // const prefetch = graphqlCosmos.prefetchOfObject(info)

  // const query = graphqlCosmos.buildQuery({
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

  // const feed = await graphqlCosmos.query<{ id: string }>(query)
  // if (feed.resources?.length > 1) {
  //   failql(`defaultCosmosResolveOneRoot expects a single result`, info)
  // }

  // return (feed.resources??[]).map(wrapSingleSourceDescriptor(returnType.typename, database, container))[0]

  const graphqlCosmos = context.dataSources.graphqlCosmos
  const field = graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const type = graphqlCosmos.meta.requireType(field.returnTypename)
  const current = (await defaultCosmosResolveColumnOurs(parent, args, context, info)) ?? null

  if (field.returnMany) {
    const container = field.container ?? type.container ?? failql(`requires container`, info)
    const database = field.database ?? type.database ?? failql(`requires database`, info)
    return current?.filter(Boolean).map((obj: any) =>
      graphqlCosmos.single(type.typename, database, container, {
        id: getObjectId(obj) ?? failql(`one or more results is missing an id value`, info),
      })
    )
  } else {
    if (current) {
      const container = field.container ?? type.container ?? failql(`requires container`, info)
      const database = field.database ?? type.database ?? failql(`requires database`, info)
      return graphqlCosmos.single(type.typename, database, container, {
        id: getObjectId(current) ?? failql(`one or more results is missing an id value`, info),
      })
    }
  }
}
