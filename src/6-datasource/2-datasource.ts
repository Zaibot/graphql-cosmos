import { FeedResponse, JSONValue, SqlQuerySpec } from '@azure/cosmos'
import { FieldNode, SelectionNode } from 'graphql/language/ast'
import { GraphQLResolveInfo } from 'graphql/type/definition'
import { DataLoaderHandler } from '../2-dataloader/loader'
import { DataLoaderSpec } from '../2-dataloader/spec'
import { MetaField, MetaSchema } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { SourceDescriptor } from '../5-resolvers/x-descriptors'
import { ErrorMiddleware } from '../error'
import { defined, fail } from '../typescript'
import { GraphQLCosmosConceptContext } from './1-context'
import { GraphQLCosmosDataSourcePlugin } from './3-plugin'
import { DataSourceQuery, DataSourceQueryResponse } from './4-query'
import { CosmosHandler } from './5-cosmos'
import { ApolloDataSource, ApolloDataSourceConfig } from './x-apollo'
import { transformSort } from './x-sort'
import { indexWhere, transformWhere } from './x-where'

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
  enablePrefetch = true
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
    return { origin: query, sql, limit: null }
  }

  async load<T>(source: SourceDescriptor.Embedded<{ id: string }> | SourceDescriptor.Single, column: string) {
    const descriptor = SourceDescriptor.hasDescriptor(source) ? source.__descriptor : source

    const id = SourceDescriptor.getObjectId(descriptor) ?? fail(`expects source to have an id`)
    const context = this.context ?? fail(`requires context for fetching value ${descriptor.typename}.${column}`)
    const dataloader = this.dataloader ?? fail(`requires dataloader for fetching value ${descriptor.typename}.${column}`)
    const spec: DataLoaderSpec = {
      container: descriptor.container,
      columns: [column],
      id: [id],
      context: context,
      database: descriptor.database,
      typename: descriptor.typename,
    }
    const data = await dataloader(spec)
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
      return SourceDescriptor.withDescriptor(
        { __typename: typename, ...data },
        { kind: `Single`, typename, database, container, id: data.id }
      )
    }
  }

  external<T extends { id: string }>(typename: string, data: T): T
  external<T extends { id: string }>(typename: string, data: T | null): T | null
  external<T extends { id: string }>(typename: string, data: T | null): T | null {
    if (data === null) {
      return null
    } else {
      return { __typename: typename, ...data }
    }
  }

  prefetchOfSelection(typename: string, selections: readonly SelectionNode[]) {
    if (this.enablePrefetch) {
      const prefetch = selections
        .map((x) => (x.kind === `Field` ? x.name.value : null))
        .filter(defined)
        .map((fieldname) => this.meta.field(typename, fieldname))
        .filter((x): x is MetaField => !!x && x.theirs === null)
        .map((x) => x.ours ?? x.fieldname)
      return prefetch
    } else {
      return []
    }
  }

  prefetchOfPage(info: GraphQLResolveInfo) {
    if (this.enablePrefetch) {
      const field = this.meta.field(info.parentType.name, info.fieldName)
      if (field) {
        const fieldNode = info.fieldNodes.find((x) => x.name.value === info.fieldName)
        const fieldPage = (fieldNode?.selectionSet?.selections ?? []).find(
          (x): x is FieldNode => x.kind === `Field` && x.name.value === `page`
        )
        const selections = fieldPage?.selectionSet?.selections
        if (selections) {
          return this.prefetchOfSelection(field.returnTypename, selections)
        }
      }
      return []
    } else {
      return []
    }
  }

  prefetchOfObject(info: GraphQLResolveInfo) {
    if (this.enablePrefetch) {
      const field = this.meta.field(info.parentType.name, info.fieldName)
      if (field) {
        const fieldNode = info.fieldNodes.find((x) => x.name.value === info.fieldName)
        const selections = fieldNode?.selectionSet?.selections
        if (selections) {
          return this.prefetchOfSelection(field.returnTypename, selections)
        }
      }
      return []
    } else {
      return []
    }
  }

  // prefetchApply<T>(typename: string, obj: T){
  //   return Object.fromEntries(Object.entries(obj).map(([k,v]) =>  [this.meta.oursField(typename, k)?.fieldname,  ))
  // }
}

export interface GraphQLCosmosArgs {
  where: Record<string, unknown>
  sort: Record<string, number>
}
