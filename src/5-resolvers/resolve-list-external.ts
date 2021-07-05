import { defaultCosmosResolveColumnOurs } from './resolve-column'
import { GraphQLCosmosFieldResolver } from './resolver'

export const defaultCosmosResolveExternalListOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const type = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)
  const current = (await defaultCosmosResolveColumnOurs(parent, args, context, info)) ?? null

  return (current ?? []).map((item: any) =>
    typeof item === `string`
      ? context.dataSources.graphqlCosmos.external(type.typename, { id: item })
      : context.dataSources.graphqlCosmos.external(type.typename, item)
  )
}
