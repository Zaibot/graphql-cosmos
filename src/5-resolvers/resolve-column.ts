import { requireGraphQLCosmos } from '../6-datasource/1-context'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosResolveColumnOurs: GraphQLCosmosFieldResolver = async (parent, _args, context, info) => {
  const graphqlCosmos = requireGraphQLCosmos(context)
  const field = graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const column = field.ours ?? field.fieldname
  const source = SourceDescriptor.getDescriptor(parent)
  if (parent.hasOwnProperty(column)) {
    return (parent as any)[column]
  } else if (source?.kind === `Single`) {
    return await graphqlCosmos.load(source, column)
  }
}
