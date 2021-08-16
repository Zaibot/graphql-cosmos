import { GraphQLCosmosPageInput } from '../4-resolver-builder/3-typedefs-transformer'
import { requireGraphQLCosmos } from '../6-datasource/1-context'
import { failql, lazy, valueIfOne } from '../typescript'
import { parseInputSort, parseInputWhere } from './input-args'
import { emptyPageResponse, graphqlCosmosPageResponse } from './internals/utils'
import { defaultCosmosResolveColumnOurs } from './resolve-column'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolvePageByOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const graphqlCosmos = requireGraphQLCosmos(context)
  const field = graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const returnType = graphqlCosmos.meta.requireType(field.returnTypename)

  const current = valueIfOne((await defaultCosmosResolveColumnOurs(parent, args, context, info)) ?? []) ?? null
  if (current == null) {
    return emptyPageResponse
  }

  const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
  const cursor = pageArgs.cursor ?? null
  const limit = pageArgs.limit ?? 50
  const resolverWhere = Array.isArray(current)
    ? { [`${field.theirs ?? `id`}_in`]: current }
    : { [`${field.theirs ?? `id`}_eq`]: current }
  const where = parseInputWhere(pageArgs.where ? { and: [pageArgs.where ?? {}, resolverWhere] } : resolverWhere)
  const sort = parseInputSort(pageArgs.sort ?? {})
  const database = field.database ?? returnType.database ?? failql(`requires database`, info)
  const container = field.container ?? returnType.container ?? failql(`requires container`, info)

  const prefetch = graphqlCosmos.prefetchOfPage(info)

  const query = lazy(async () => {
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
    const result = await graphqlCosmos.query<{ id: string }>(query)
    return result
  })

  const count = lazy(async () => {
    const query = graphqlCosmos.buildCountQuery({
      database,
      container,
      context,
      cursor: null,
      fields: [],
      origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
      sort: [],
      where,
      typename: returnType.typename,
      limit: null,
    })
    const result = await graphqlCosmos.query<number>(query)
    return result
  })

  return graphqlCosmosPageResponse(cursor, query, count, (x) =>
    graphqlCosmos.single(returnType.typename, database, container, x)
  )
}
