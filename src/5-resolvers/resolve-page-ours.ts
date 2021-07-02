import { GraphQLCosmosPageInput } from '../4-resolver-builder/3-schema-transformer'
import { failql, lazy } from '../typescript'
import { parseInputSort, parseInputWhere } from './input-args'
import { graphqlCosmosPageResponse } from './internals/utils'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolvePageByOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const parentType = context.dataSources.graphqlCosmos.meta.requireType(info.parentType.name)
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const returnType = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)

  const source = SourceDescriptor.getDescriptor(parent)

  if (source?.kind !== `Single`) {
    failql(`expects source be of type Single`, info)
  }

  const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
  const cursor = pageArgs.cursor ?? null
  const limit = pageArgs.limit ?? 50
  const where = parseInputWhere({ and: [pageArgs.where ?? {}, { [`${field.theirs ?? `id`}_in`]: current }] })
  const sort = parseInputSort(pageArgs.sort ?? {})

  const database = field.database ?? parentType.database ?? failql(`requires database`, info)
  const container = field.container ?? parentType.container ?? failql(`requires container`, info)

  const query = lazy(async () => {
    const query = context.dataSources.graphqlCosmos.buildQuery({
      database,
      container,
      context,
      cursor,
      fields: [`id`],
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
