import { CosmosQueryHandler, GraphQLCosmosInitRequest, GraphQLCosmosRequest } from './configuration'
import { createDataLoader, GraphQLCosmosDataLoaderResolver } from './dataloader'
import { CosmosRequest } from './intermediate/model'
import { convertToSql } from './sql'

export const defaultOnQuery = ({ client, database, container, query, parameters, options }: GraphQLCosmosRequest) =>
  client.database(database).container(container).items.query({ query, parameters }, options).fetchNext()

export const defaultOnInit = (request: CosmosRequest, init: GraphQLCosmosInitRequest) => {
  const sql = convertToSql(request)
  init.query = sql.sql
  init.parameters = sql.parameters
  init.options ??= {}
  init.options.continuationToken = request.cursor
}

export const defaultDataLoader = (onQuery: CosmosQueryHandler): GraphQLCosmosDataLoaderResolver => {
  const loader = createDataLoader({ onQuery })
  return (spec) => {
    return loader(spec)
  }
}
