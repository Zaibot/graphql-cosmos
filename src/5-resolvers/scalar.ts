import { defaultCosmosFieldResolver } from './default'
import { GraphQLCosmosFieldResolver } from './resolver'

export const defaultCosmosScalarFieldResolver: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const current = await defaultCosmosFieldResolver(parent, args, context, info)
  return current
}
