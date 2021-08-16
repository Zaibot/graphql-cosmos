import { fail } from '../typescript'
import { GraphQLCosmosDataSource } from './2-datasource'

export interface GraphQLCosmosConceptContext<TContext = unknown> {
  dataSources: {
    graphqlCosmos: GraphQLCosmosDataSource<TContext>
  }
}

export function requireGraphQLCosmos<TContext>(
  context: GraphQLCosmosConceptContext<TContext>
): GraphQLCosmosDataSource<TContext> {
  return context.dataSources?.graphqlCosmos ?? fail(`could not find data source graphqlCosmos in the query context`)
}

export function getGraphQLCosmos<TContext>(
  context: GraphQLCosmosConceptContext<TContext>
): GraphQLCosmosDataSource<TContext> | null {
  return context.dataSources?.graphqlCosmos ?? null
}
