import { FeedResponse, JSONValue, SqlQuerySpec } from '@azure/cosmos'
import { transformSort } from './x-sort'
import { indexWhere, transformWhere } from './x-where'
import { DataLoaderHandler } from '../2-dataloader/loader'
import { MetaSchema } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { SourceDescriptor } from '../5-resolvers/x-descriptors'
import { ErrorMiddleware } from '../error'
import { fail } from '../typescript'
import { ApolloDataSource, ApolloDataSourceConfig } from './x-apollo'
import { GraphQLCosmosConceptContext } from './1-context'
import { CosmosHandler } from './5-cosmos'
import { GraphQLCosmosDataSourcePlugin } from './3-plugin'
import { DataSourceQuery, DataSourceQueryResponse } from './4-query'

export interface CosmosEntity {
  id: string
}

export class GraphQLCosmosDataSource<TContext = unknown> extends ApolloDataSource<
  GraphQLCosmosConceptContext<TContext>
> {
  meta: MetaIndex
  dataloader: DataLoaderHandler
  cosmos: CosmosHandler
  context: GraphQLCosmosConceptContext<TContext> | null = null
  plugin: GraphQLCosmosDataSourcePlugin
  onError: ErrorMiddleware

  constructor(
    meta: MetaSchema,
    dataloader: DataLoaderHandler,
    cosmos: CosmosHandler,
    plugin: GraphQLCosmosDataSourcePlugin,
    onError: ErrorMiddleware
  ) {
    super()
    this.meta = new MetaIndex(meta)
    this.dataloader = dataloader
    this.cosmos = cosmos
    this.plugin = plugin
    this.onError = onError
  }

  initialize(config: ApolloDataSourceConfig<GraphQLCosmosConceptContext<TContext>>) {
    this.context = config.context
  }

  buildQuery(query: DataSourceQuery): DataSourceQueryResponse {
    const alias = `c`
    const limit = query.limit
    const output = indexWhere(query.where)
    const wheresql = transformWhere(this.meta, query.typename, output, query.where, alias).join(` AND `)
    const sortsql = transformSort(query.sort.concat({ fieldname: `id`, direction: `ASC` }), alias).join(`, `)

    const WHERE = wheresql ? ` WHERE ${wheresql}` : ``
    const SORT = sortsql ? ` ORDER BY ${sortsql}` : ``

    const params = Array.from(output.entries()).map(([v, k]) => ({ name: k, value: v as JSONValue }))

    const dbfieldnames = Array.from(
      new Set(query.fields /*.map((x) => this.meta.requireField(query.typename, x)).map((x) => x.ours ?? x.fieldname)*/)
    )
    const SELECT = dbfieldnames.map((x) => `${alias}.${x}`).join(`, `)
    const sql: SqlQuerySpec = {
      query: `SELECT ${SELECT} FROM ${alias}${WHERE}${SORT}`,
      parameters: params,
    }
    return { origin: query, sql, limit }
  }

  buildCountQuery(query: DataSourceQuery): DataSourceQueryResponse {
    const alias = `c`
    const output = indexWhere(query.where)
    const wheresql = transformWhere(this.meta, query.typename, output, query.where, alias).join(` AND `)

    const WHERE = wheresql ? ` WHERE ${wheresql}` : ``

    const params = Array.from(output.entries()).map(([v, k]) => ({ name: k, value: v as JSONValue }))

    const sql: SqlQuerySpec = {
      query: `SELECT VALUE COUNT(1) FROM ${alias}${WHERE}`,
      parameters: params,
    }
    return { origin: query, sql, limit: 50 }
  }

  async load<T>(source: SourceDescriptor.Single, column: string) {
    const context = this.context ?? fail(`requires context for fetching value ${source.typename}.${column}`)
    const dataloader = this.dataloader ?? fail(`requires dataloader for fetching value ${source.typename}.${column}`)
    const data = await dataloader({
      container: source.container,
      columns: [column],
      id: [source.id],
      context: context,
      database: source.database,
      typename: source.typename,
    })
    const value: T = Object(data[0])[column]
    return value
  }

  async query<T = unknown>(query: DataSourceQueryResponse): Promise<FeedResponse<T>> {
    const context = this.context ?? fail(`requires context`)
    const result: FeedResponse<unknown> = await this.cosmos(
      context,
      query.origin.database,
      query.origin.container,
      query.sql,
      query.origin.cursor,
      query.limit
    )
    return result as FeedResponse<T>
  }

  refSingle(typename: string, database: string, container: string, id: string): SourceDescriptor.Single
  refSingle(typename: string, database: string, container: string, id: string | null): SourceDescriptor.Single | null
  refSingle(typename: string, database: string, container: string, id: string | null): SourceDescriptor.Single | null {
    if (id === null) {
      return null
    } else {
      return { kind: `Single`, typename, database, container, id }
    }
  }

  single<T extends CosmosEntity>(
    typename: string,
    database: string,
    container: string,
    data: T
  ): SourceDescriptor.Embedded<T>
  single<T extends CosmosEntity>(
    typename: string,
    database: string,
    container: string,
    data: T | null
  ): SourceDescriptor.Embedded<T> | null
  single<T extends CosmosEntity>(
    typename: string,
    database: string,
    container: string,
    data: T | null
  ): SourceDescriptor.Embedded<T> | null {
    if (data === null) {
      return null
    } else {
      return SourceDescriptor.withDescriptor(data, { kind: `Single`, typename, database, container, id: data.id })
    }
  }
}

export interface GraphQLCosmosArgs {
  where: Record<string, unknown>
  sort: Record<string, number>
}
