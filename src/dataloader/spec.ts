import { GraphQLCosmosContext } from '../configuration'
import { SqlOpScalar } from '../sql/op'

export interface DataLoaderSpec {
  context: GraphQLCosmosContext
  container: string
  id: SqlOpScalar[]
  columns: string[]
}
