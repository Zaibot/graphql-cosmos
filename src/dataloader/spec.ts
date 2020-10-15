import { GraphQLCosmosContext, GraphQLDirectivesContext } from '../configuration'
import { SqlOpScalar } from '../sql/op'

export interface DataLoaderSpec<GraphQLContext> {
  context: GraphQLContext
  database: string
  container: string
  id: SqlOpScalar[]
  columns: string[]
}
