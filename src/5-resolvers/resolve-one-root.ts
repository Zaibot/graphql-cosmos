import { GraphQLCosmosPageInput } from '../4-resolver-builder/3-schema-transformer'
import { failql } from '../typescript'
import { parseInputWhere } from './input-args'
import { wrapSingleSourceDescriptor } from './internals/utils'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolveOneRoot: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const parentType = context.dataSources.graphqlCosmos.meta.requireType(info.parentType.name)
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const returnType = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)

  const source = SourceDescriptor.getDescriptor(parent)
  if (source) {
    failql(`defaultCosmosResolvePageRoot does not except a source`, info)
  }

  const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
  const where = parseInputWhere(pageArgs.where ?? {})

  const database = field.database ?? parentType.database ?? failql(`requires database`, info)
  const container = field.container ?? parentType.container ?? failql(`requires container`, info)

  const query = context.dataSources.graphqlCosmos.buildQuery({
    database,
    container,
    context,
    cursor: null,
    fields: [`id`],
    origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
    sort: [],
    where,
    typename: returnType.typename,
    limit: 2,
  })

  const feed = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
  if (feed.resources.length > 1) {
    failql(`defaultCosmosResolveOneRoot expects a single result`, info)
  }

  return feed.resources.map(wrapSingleSourceDescriptor(returnType.typename, database, container))
}
