import { DataLoaderSpec } from './spec'

export type DataLoaderCombineHandler = (left: DataLoaderSpec, right: DataLoaderSpec) => DataLoaderSpec | null

export const defaultOnDataLoaderCombine: DataLoaderCombineHandler = (left, right) => {
  const sameDatabase = left.database === right.database
  const sameContainer = left.container === right.container
  if (sameDatabase && sameContainer) {
    return {
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
