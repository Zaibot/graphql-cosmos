import { unique } from '../typescript'
import { DataLoaderSpec } from './spec'

export type DataLoaderCombineHandler = (left: DataLoaderSpec, right: DataLoaderSpec) => DataLoaderSpec | null

export const defaultOnDataLoaderCombine = (left: DataLoaderSpec, right: DataLoaderSpec): DataLoaderSpec | null => {
  const sameContext = left.context === right.context
  const sameDatabase = left.database === right.database
  const sameContainer = left.container === right.container
  const sameTypename = left.typename === right.typename
  if (sameContext && sameDatabase && sameContainer && sameTypename) {
    return {
      context: left.context,
      database: left.database,
      container: left.container,
      typename: left.typename,
      id: unique(left.id, right.id),
      columns: unique(left.columns, right.columns),
    }
  } else {
    return null
  }
}
