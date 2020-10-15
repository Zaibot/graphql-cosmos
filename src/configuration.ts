import { CosmosClient, FeedOptions, FeedResponse } from '@azure/cosmos'
import { DataLoaderHandler } from './dataloader/loader'
import { CosmosRequest } from './intermediate/model'
import { SqlBuilder } from './sql/builder'

export interface GraphQLCosmosContext {
  directives: GraphQLDirectivesContext
}

export type CosmosQueryHandler = (request: GraphQLCosmosRequest) => Promise<FeedResponse<any>>

export interface GraphQLDirectivesContext {
  cosmos: {
    database: string
    client: CosmosClient
    dataloader?: DataLoaderHandler<GraphQLCosmosContext>
    /** default: defaultOnInit */
    onInit?: (request: CosmosRequest, init: GraphQLCosmosInitRequest) => void
    onBeforeQuery?: (request: GraphQLCosmosInitRequest) => void
    /** default: defaultOnQuery */
    onQuery?: CosmosQueryHandler
  }
}

export interface GraphQLCosmosInitRequest {
  client: CosmosClient
  request: CosmosRequest
  database: string
  container: string
  query?: SqlBuilder
  parameters?: Array<{ name: string; value: any }>
  options?: FeedOptions
}

export interface GraphQLCosmosRequest {
  init?: GraphQLCosmosInitRequest
  client: CosmosClient
  database: string
  container: string
  query: string
  parameters: Array<{ name: string; value: any }>
  options?: FeedOptions
}
