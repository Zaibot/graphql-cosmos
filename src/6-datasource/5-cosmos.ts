import { FeedResponse, SqlQuerySpec } from '@azure/cosmos'
import { GraphQLCosmosConceptContext } from './1-context'

export type CosmosHandler = (
  context: GraphQLCosmosConceptContext<unknown>,
  database: string,
  container: string,
  sql: SqlQuerySpec,
  cursor: string | null,
  limit: number | null
) => Promise<FeedResponse<unknown>>
