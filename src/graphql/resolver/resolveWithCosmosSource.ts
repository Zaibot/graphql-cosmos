import * as GraphQL from 'graphql'
import { GraphQLCosmosContext } from '../../configuration'

export const resolveCosmosSource = (container: string | null | undefined, columnId: string, requiresColumn: string) => {
  return async (source: any, context: GraphQLCosmosContext) => {
    if (!source) throw Error(`requires a source`)
    if (typeof source === `object` && requiresColumn in source) {
      // Information already available
      return source
    } else {
      if (!container) {
        throw Error(`unable to resolve with cosmos source, container undefined`)
      }

      // Fetch record from cosmos with the field we require
      const dataloader = context.directives.cosmos.dataloader
      const database = context.directives.cosmos.database
      const cosmosSource: any = await dataloader?.({
        database,
        container,
        id: [source[columnId]],
        columns: [requiresColumn],
      })
      const combinedSource = { ...source, ...cosmosSource?.[0] }
      return combinedSource
    }
  }
}

export const resolveWithCosmosSource = (
  container: string | null | undefined,
  columnId: string,
  requiresColumn: string,
  resolver: GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => {
  return async (source, args, context, info) => {
    if (!source) throw Error(`requires a source`)
    if (typeof source === `object` && requiresColumn in source) {
      // Information already available
      return resolver(source, args, context, info)
    } else {
      if (!container) {
        throw Error(`unable to resolve with cosmos source, container undefined`)
      }

      // Fetch record from cosmos with the field we require
      const dataloader = context.directives.cosmos.dataloader
      const database = context.directives.cosmos.database
      const cosmosSource: any = await dataloader?.({
        database,
        container,
        id: [source[columnId]],
        columns: [requiresColumn],
      })
      const combinedSource = { ...source, ...cosmosSource?.[0] }
      return resolver(combinedSource, args, context, info)
    }
  }
}
