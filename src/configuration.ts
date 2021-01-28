import { CosmosClient, FeedOptions, FeedResponse } from '@azure/cosmos'
import { DataLoaderHandler } from './dataloader/loader'
import { CosmosRequest } from './intermediate/model'
import { SqlBuilder } from './sql/builder'
import { SqlOpScalar } from './sql/op'

export interface GraphQLCosmosContext {
  directives: GraphQLDirectivesContext
}

export interface GraphQLDirectivesContext {
  cosmos: {
    database: string
    client: CosmosClient
    dataloader?: DataLoaderHandler
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
  parameters?: Array<{ name: string; value: SqlOpScalar }>
  options?: FeedOptions
}

export type CosmosQueryHandler = (request: GraphQLCosmosRequest) => Promise<FeedResponse<unknown>>

export interface GraphQLCosmosRequest {
  init?: GraphQLCosmosInitRequest
  client: CosmosClient
  database: string
  container: string
  query: string
  parameters: Array<{ name: string; value: SqlOpScalar }>
  options?: FeedOptions
}
