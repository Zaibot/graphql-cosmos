import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolveColumnOurs: GraphQLCosmosFieldResolver = async (parent, _args, context, info) => {
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const column = field.ours ?? field.fieldname
  const source = SourceDescriptor.getDescriptor(parent)
  if (parent.hasOwnProperty(column)) {
    return (parent as any)[column]
  } else if (source?.kind === `Single`) {
    return await context.dataSources.graphqlCosmos.load(source, column)
  }
}
