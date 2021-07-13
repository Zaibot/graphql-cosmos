import { GraphQLCosmosPageInput } from '../4-resolver-builder/3-typedefs-transformer'
import { failql, valueIfOne } from '../typescript'
import { parseInputSort, parseInputWhere } from './input-args'
import { defaultCosmosResolveColumnOurs } from './resolve-column'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolveListByOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const graphqlCosmos = context.dataSources.graphqlCosmos
  const parentType = graphqlCosmos.meta.requireType(info.parentType.name)
  const field = graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const returnType = graphqlCosmos.meta.requireType(field.returnTypename)

  const current = valueIfOne((await defaultCosmosResolveColumnOurs(parent, args, context, info)) ?? []) ?? null
  if (current == null) {
    return []
  }

  const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
  const cursor = pageArgs.cursor ?? null
  const limit = pageArgs.limit ?? null
  const resolverWhere = Array.isArray(current)
    ? { [`${field.theirs ?? `id`}_in`]: current }
    : { [`${field.theirs ?? `id`}_eq`]: current }
  const where = parseInputWhere(pageArgs.where ? { and: [pageArgs.where ?? {}, resolverWhere] } : resolverWhere)
  const sort = parseInputSort(pageArgs.sort ?? {})

  const database = field.database ?? parentType.database ?? failql(`requires database`, info)
  const container = field.container ?? parentType.container ?? failql(`requires container`, info)

  const prefetch = graphqlCosmos.prefetchOfObject(info)

  const query = graphqlCosmos.buildQuery({
    database,
    container,
    context,
    cursor,
    fields: [`id`].concat(prefetch),
    origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
    sort,
    where,
    typename: returnType.typename,
    limit,
  })

  const feed = await graphqlCosmos.query<{ id: string }>(query)
  return (feed.resources ?? []).map((x) => graphqlCosmos.single(returnType.typename, database, container, x))
}
