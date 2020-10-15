import { DataLoaderSpec } from './spec'

export type DataLoaderCombineHandler<GraphQLContext> = (
  left: DataLoaderSpec<GraphQLContext>,
  right: DataLoaderSpec<GraphQLContext>
) => DataLoaderSpec<GraphQLContext> | null

export const defaultOnDataLoaderCombine = <GraphQLContext>(
  left: DataLoaderSpec<GraphQLContext>,
  right: DataLoaderSpec<GraphQLContext>
): DataLoaderSpec<GraphQLContext> | null => {
  const sameContext = left.context === right.context
  const sameDatabase = left.database === right.database
  const sameContainer = left.container === right.container
  if (sameContext && sameDatabase && sameContainer) {
    return {
      context: left.context,
      database: left.database,
      container: left.container,
      id: unique(left.id, right.id),
      columns: unique(left.columns, right.columns),
    }
  } else {
    return null
  }
}

const unique = <T>(...lists: T[][]) => Array.from(new Set(lists.flat()))
