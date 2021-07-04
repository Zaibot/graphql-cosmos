import { defaultCosmosResolveColumnOurs } from './resolve-column'
import { GraphQLCosmosFieldResolver } from './resolver'

export const defaultCosmosResolveExternalOneOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const type = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)
  const current = (await defaultCosmosResolveColumnOurs(parent, args, context, info)) ?? null

  if (typeof current === `string`) {
    return context.dataSources.graphqlCosmos.external(type.typename, { id: current })
  } else {
    return context.dataSources.graphqlCosmos.external(type.typename, current)
  }
}
