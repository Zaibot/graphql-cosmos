import { GraphQLResolveInfo } from 'graphql/type'
import { SqlOpScalar } from '../sql/op'

export interface CosmosRequest {
  type: 'query' | 'count' | 'dataloader'
  resolverDescription: string
  graphqlInfo?: GraphQLResolveInfo
  columns: Array<string>
  where: Array<CosmosArgWhere>
  sort: Array<CosmosArgSort> | false
  cursor: string | undefined
}

export interface CosmosArgWhere {
  property: string
  operation: string
  value: SqlOpScalar
  parameter: string
}

export interface CosmosArgSort {
  property: string
  direction: string
}
