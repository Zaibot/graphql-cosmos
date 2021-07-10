import { defaultCosmosResolveColumnOurs } from './resolve-column'
import { GraphQLCosmosFieldResolver } from './resolver'

export const defaultCosmosResolveExternalOneOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const graphqlCosmos = context.dataSources.graphqlCosmos
  const field = graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const type = graphqlCosmos.meta.requireType(field.returnTypename)
  const current = (await defaultCosmosResolveColumnOurs(parent, args, context, info)) ?? null

  if (typeof current === `string`) {
    return graphqlCosmos.external(type.typename, { id: current })
  } else {
    return graphqlCosmos.external(type.typename, current)
  }
}
