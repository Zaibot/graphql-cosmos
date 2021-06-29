import { GraphQLCosmosDataSource } from './2-datasource'

export interface GraphQLCosmosConceptContext<TContext = unknown> {
  dataSources: {
    graphqlCosmos: GraphQLCosmosDataSource<TContext>
  }
}
