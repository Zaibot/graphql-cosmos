import { SourceDescriptor } from '../5-resolvers/x-descriptors'
import { Sort } from './x-sort'
import { Where } from './x-where'
import { GraphQLCosmosConceptContext } from './1-context'
import { SqlQuerySpec } from '@azure/cosmos'

export interface DataSourceQuery {
  context: GraphQLCosmosConceptContext<unknown>
  origin: SourceDescriptor.Embedded<unknown> | null
  database: string
  container: string
  fields: string[]
  where: Where
  sort: Sort
  cursor: string | null
  typename: string
  limit: number | null
}

export interface DataSourceQueryResponse {
  origin: DataSourceQuery
  limit: number | null
  sql: SqlQuerySpec
}
