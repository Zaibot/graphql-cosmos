import DataLoader from 'dataloader'
import {
  CosmosQueryHandler,
  DataLoaderSpec,
  GraphQLCosmosDataLoaderResolver,
  GraphQLCosmosInitRequest,
  GraphQLCosmosRequest,
} from './configuration'
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

export const defaultDataLoader = (onQuery: CosmosQueryHandler): GraphQLCosmosDataLoaderResolver => ({
  container,
}: {
  container: string
}) => {
  const loader = new DataLoader(async (todo: readonly DataLoaderSpec[]) => {
    const ids = Array.from(new Set(todo.map((x) => x.id)))
    const columns = Array.from(new Set(todo.flatMap((x) => x.columns)))
    const c = columns.length ? [`id`, ...columns].map((x) => `r.${x}`).join(`, `) : `*`
    const itemsRaw = onQuery({
      database: null as any,
      client: null as any,
      container,
      query: `SELECT ${c} FROM r WHERE ARRAY_CONTAINS(@batch, r.id)`,
      parameters: [{ name: `@batch`, value: ids }],
    })
    const items = new Map((await itemsRaw).resources.map((x: any) => [x.id, { ...x, id: x.id }]))
    return todo.map(({ id }) => items.get(id))
  })
  return (spec) => loader.load(spec)
}
