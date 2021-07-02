import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosFieldResolver: GraphQLCosmosFieldResolver = async (parent, _args, context, info) => {
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const column = field.ours ?? field.fieldname
  const source = SourceDescriptor.getDescriptor(parent)
  if (source?.kind === `Single`) {
    const value = await context.dataSources.graphqlCosmos.load(source, column)
    return value
  } else {
    const value = Object(parent)[column]
    return value
  }
}

// export const defaultCosmosWhereFieldResolver: GraphQLCosmosFieldResolver = (parent, _args, context, info) => {
//   const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
//   const column = field.whereOurs ?? field.ours ?? field.fieldname
//   const source = SourceDescriptor.getDescriptor(parent)
//   if (source?.kind === `Single`) {
//     return context.dataSources.graphqlCosmos.load(source, column)
//   } else {
//     const value = Object(parent)[column]
//     console.log(`EMBEDDED ${info.parentType}.${info.fieldName} = ${value}`)
//     return value
//   }
// }

// export const defaultCosmosSortFieldResolver: GraphQLCosmosFieldResolver = (parent, _args, context, info) => {
//   const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
//   const column = field.sortOurs ?? field.ours ?? field.fieldname
//   const source = SourceDescriptor.getDescriptor(parent)
//   if (source?.kind === `Single`) {
//     return context.dataSources.graphqlCosmos.load(source, column)
//   } else {
//     const value = Object(parent)[column]
//     return value
//   }
// }
