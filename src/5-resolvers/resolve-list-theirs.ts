import { GraphQLCosmosPageInput } from '../4-resolver-builder/3-schema-transformer'
import { fail, failql } from '../typescript'
import { parseInputSort, parseInputWhere } from './input-args'
import { wrapSingleSourceDescriptor } from './internals/utils'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolveListByTheirs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const parentType = context.dataSources.graphqlCosmos.meta.requireType(info.parentType.name)
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const returnType = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)
  const theirField =
    context.dataSources.graphqlCosmos.meta.oursField(field.returnTypename, field.theirs ?? `id`) ??
    fail(`can't find theirs: ${field.returnTypename}.${field.theirs ?? `id`}`)

  const source = SourceDescriptor.getDescriptor(parent)

  if (source?.kind !== `Single`) {
    failql(`expects source be of type Single`, info)
  }

  const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
  const cursor = pageArgs.cursor ?? null
  const limit = pageArgs.limit ?? 50
  const where = parseInputWhere({
    and: [
      pageArgs.where ?? {},
      theirField.returnMany ? { [`${field.theirs}_in`]: source.id } : { [`${field.theirs}_eq`]: source.id },
    ],
  })
  const sort = parseInputSort(pageArgs.sort ?? {})

  const database = field.database ?? returnType.database ?? failql(`requires database`, info)
  const container = field.container ?? returnType.container ?? failql(`requires container`, info)

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
