import { GraphQLCosmosContext } from '../../configuration'
import { CosmosTag, getCosmosTagContainer } from '../reference'

export const hasId = <T>(obj: unknown): obj is T & { id: string } => {
  return typeof Object(obj)?.id === `string`
}

export const requireCosmosColumn = async <Source extends { id: string; __cosmos_tag: CosmosTag }>(
  source: Source,
  column: string,
  context: GraphQLCosmosContext
): Promise<Record<string, unknown>> => {
  const dataloader = context.directives.cosmos.dataloader

  const container = getCosmosTagContainer(source)
  if (!container) {
    throw Error(`unable to resolve with cosmos source, container undefined`)
  }

  if (column in source) {
    // Information already available
    return source
  } else {
    // Fetch record from cosmos with the field we require
    const cosmosSource = await dataloader?.({
      context,
      container,
      id: [source.id],
      columns: [column],
    })

    if (!Array.isArray(cosmosSource)) {
      throw Error(`expects array as dataloader result`)
    }
    if (cosmosSource.length !== 1) {
      throw Error(`expects single dataloader result`)
    }
    if (typeof cosmosSource[0] !== `object`) {
      throw Error(`expects single object dataloader result`)
    }

    const value = cosmosSource[0][column] ?? null

    const combinedSource = { ...source, [column]: value }
    return combinedSource
  }
}
