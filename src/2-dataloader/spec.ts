import { GraphQLCosmosConceptContext } from '../6-datasource/1-context'

export interface DataLoaderSpec {
  context: GraphQLCosmosConceptContext<unknown>
  container: string
  database: string
  typename: string
  id: string[]
  columns: string[]
}
