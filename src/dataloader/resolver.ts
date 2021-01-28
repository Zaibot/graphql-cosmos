import { GraphQLCosmosInitRequest, GraphQLCosmosRequest } from '../configuration'
import { defaultOnInit, defaultOnQuery } from '../default'
import { CosmosRequest } from '../intermediate/model'
import { DataLoaderSpec } from './spec'

export type DataLoaderResolveHandler = (spec: DataLoaderSpec) => Promise<Array<unknown>>

export const defaultOnDataLoaderResolve: DataLoaderResolveHandler = async (
  spec: DataLoaderSpec
): Promise<Array<unknown>> => {
  const { onInit = defaultOnInit, onBeforeQuery, onQuery = defaultOnQuery } = spec.context.directives.cosmos

  const whereIds = unique(spec.id)
  const selectColumns = unique(spec.columns)

  const graphquery: CosmosRequest = {
    columns: selectColumns.length ? [`id`, ...selectColumns] : [],
    cursor: undefined,
    resolverDescription: `dataloader`,
    sort: false,
    type: 'dataloader',
    where: [
      {
        operation: `in`,
        parameter: `@batch`,
        property: `id`,
        value: whereIds,
      },
    ],
  }

  const init: GraphQLCosmosInitRequest = {
    client: spec.context.directives.cosmos.client,
    database: spec.context.directives.cosmos.database,
    container: spec.container,
    request: graphquery,
    options: {},
  }
  onInit(graphquery, init)

  //
  // Notify query about to be requested
  onBeforeQuery?.(init)

  if (!init.query) {
    throw Error(`requires query`)
  }
  if (!init.parameters) {
    throw Error(`requires query parameters`)
  }

  //
  // Send CosmosDB query
  const request: GraphQLCosmosRequest = {
    init,
    client: init.client,
    database: init.database,
    container: init.container,
    query: init.query.toSql(),
    parameters: init.parameters,
    options: init.options,
  }

  const response = await onQuery(request)
  return response.resources
}

const unique = <T>(...lists: T[][]) => Array.from(new Set(lists.flat()))
