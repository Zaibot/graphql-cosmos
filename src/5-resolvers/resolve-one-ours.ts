import { failql } from '../typescript'
import { defaultCosmosFieldResolver } from './default'
import { GraphQLCosmosFieldResolver } from './resolver'

export const defaultCosmosResolveOneOurs: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const type = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)
  const current = await defaultCosmosFieldResolver(parent, args, context, info)

  if (field.returnMany) {
    const container = field.container ?? type.container ?? failql(`requires container`, info)
    const database = field.database ?? type.database ?? failql(`requires database`, info)
    return current
      ?.filter(Boolean)
      .map((id: any) => context.dataSources.graphqlCosmos.single(type.typename, database, container, { id }))
  } else {
    if (current) {
      const container = field.container ?? type.container ?? failql(`requires container`, info)
      const database = field.database ?? type.database ?? failql(`requires database`, info)
      return context.dataSources.graphqlCosmos.single(type.typename, database, container, { id: current })
    }
  }
}
