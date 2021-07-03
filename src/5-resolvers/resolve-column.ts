import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolveColumnOurs: GraphQLCosmosFieldResolver = async (parent, _args, context, info) => {
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const column = field.ours ?? field.fieldname
  const source = SourceDescriptor.getDescriptor(parent)
  const current = Object(parent)[column]
  if (current !== undefined) {
    return current
  } else if (source?.kind === `Single`) {
    return await context.dataSources.graphqlCosmos.load(source, column)
  }
}
