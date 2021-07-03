import { GraphQLCosmosPageInput } from '../4-resolver-builder/3-schema-transformer'
import { failql, lazy, valueIfOne } from '../typescript'
import { defaultCosmosResolveColumnOurs } from './resolve-column'
import { parseInputSort, parseInputWhere } from './input-args'
import { emptyPageResponse, graphqlCosmosPageResponse } from './internals/utils'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolvePageByOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const returnType = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)

  const current = valueIfOne(await defaultCosmosResolveColumnOurs(parent, args, context, info)) ?? null
  if (current == null) {
    return emptyPageResponse
  }

  const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
  const cursor = pageArgs.cursor ?? null
  const limit = pageArgs.limit ?? 50
  const where = parseInputWhere({
    and: [
      pageArgs.where ?? {},
      Array.isArray(current)
        ? { [`${field.theirs ?? `id`}_in`]: current }
        : { [`${field.theirs ?? `id`}_eq`]: current },
    ],
  })
  const sort = parseInputSort(pageArgs.sort ?? {})
  const database = field.database ?? returnType.database ?? failql(`requires database`, info)
  const container = field.container ?? returnType.container ?? failql(`requires container`, info)

  const prefetch = context.dataSources.graphqlCosmos.prefetchOfPage(info)

  const query = lazy(async () => {
    const query = context.dataSources.graphqlCosmos.buildQuery({
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
    const result = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
    return result
  })

  const count = lazy(async () => {
    const query = context.dataSources.graphqlCosmos.buildCountQuery({
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
    const result = await context.dataSources.graphqlCosmos.query<number>(query)
    return result
  })

  return graphqlCosmosPageResponse(returnType.typename, database, container, cursor, query, count)
}
