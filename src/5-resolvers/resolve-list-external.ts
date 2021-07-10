import { defaultCosmosResolveColumnOurs } from './resolve-column'
import { GraphQLCosmosFieldResolver } from './resolver'

export const defaultCosmosResolveExternalListOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const graphqlCosmos = context.dataSources.graphqlCosmos
  const field = graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const type = graphqlCosmos.meta.requireType(field.returnTypename)
  const current = (await defaultCosmosResolveColumnOurs(parent, args, context, info)) ?? null

  return (current ?? []).map((item: any) =>
    typeof item === `string`
      ? graphqlCosmos.external(type.typename, { id: item })
      : graphqlCosmos.external(type.typename, item)
  )
}
