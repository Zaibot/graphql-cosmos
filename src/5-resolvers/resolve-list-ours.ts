import { GraphQLCosmosPageInput } from '../4-resolver-builder/3-schema-transformer'
import { failql } from '../typescript'
import { parseInputSort, parseInputWhere } from './input-args'
import { wrapSingleSourceDescriptor } from './internals/utils'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolveListByOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const parentType = context.dataSources.graphqlCosmos.meta.requireType(info.parentType.name)
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const returnType = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)

  const source = SourceDescriptor.getDescriptor(parent)

  const current =
    source?.kind === `Single`
      ? await context.dataSources.graphqlCosmos.load(source, field.ours ?? field.fieldname)
      : Object(parent)[field.ours ?? field.fieldname] ?? []

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

  const database = field.database ?? parentType.database ?? failql(`requires database`, info)
  const container = field.container ?? parentType.container ?? failql(`requires container`, info)

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

  const feed = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
  return feed.resources.map(wrapSingleSourceDescriptor(returnType.typename, database, container))
}
