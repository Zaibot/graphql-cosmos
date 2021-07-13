import { GraphQLCosmosPageInput } from '../4-resolver-builder/3-typedefs-transformer'
import { failql } from '../typescript'
import { parseInputSort, parseInputWhere } from './input-args'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolveListByTheirs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const graphqlCosmos = context.dataSources.graphqlCosmos
  const field = graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const returnType = graphqlCosmos.meta.requireType(field.returnTypename)
  const theirField =
    graphqlCosmos.meta.oursField(field.returnTypename, field.theirs ?? `id`) ??
    failql(`can't find theirs: ${field.returnTypename}.${field.theirs ?? `id`}`, info)

  const id = SourceDescriptor.getObjectId(parent) ?? failql(`expects parent to have an id`, info)

  const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
  const cursor = pageArgs.cursor ?? null
  const limit = pageArgs.limit ?? null
  const resolverWhere = theirField.returnMany ? { [`${field.theirs}_in`]: id } : { [`${field.theirs}_eq`]: id }
  const where = parseInputWhere(pageArgs.where ? { and: [pageArgs.where ?? {}, resolverWhere] } : resolverWhere)
  const sort = parseInputSort(pageArgs.sort ?? {})

  const database = field.database ?? returnType.database ?? failql(`requires database`, info)
  const container = field.container ?? returnType.container ?? failql(`requires container`, info)

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
