import * as GraphQL from 'graphql'
import { GraphQLCosmosContext } from '../../configuration'

export const resolveCosmosSource = async (
  container: string | null | undefined,
  columnId: string,
  requiresColumn: string,
  source: any,
  context: GraphQLCosmosContext
) => {
  if (!source) throw Error(`requires a source`)
  if (typeof source === `object` && requiresColumn in source) {
    // Information already available
    return source
  } else {
    if (!container) {
      throw Error(`unable to resolve with cosmos source, container undefined`)
    }

    const id = source[columnId]
    if (id) {
      // Fetch record from cosmos with the field we require
      const dataloader = context.directives.cosmos.dataloader
      const cosmosSource: any = await dataloader?.({
        context,
        container,
        id: [id],
        columns: [requiresColumn],
      })
      const combinedSource = { ...source, ...cosmosSource?.[0] }
      return combinedSource
    } else {
      console.warn(`[@zaibot/graphql-cosmos] source is missing id column`, {
        container,
        columnId,
        requiresColumn,
      })
      return source
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
    const combinedSource = await resolveCosmosSource(container, columnId, requiresColumn, source, context)
    const result = resolver(combinedSource, args, context, info)
    return result
  }
}
