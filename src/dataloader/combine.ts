import { DataLoaderSpec } from './spec'

export type DataLoaderCombineHandler = (left: DataLoaderSpec, right: DataLoaderSpec) => DataLoaderSpec | null

export const defaultOnDataLoaderCombine = (left: DataLoaderSpec, right: DataLoaderSpec): DataLoaderSpec | null => {
  const sameContext = left.context === right.context
  const sameContainer = left.container === right.container
  if (sameContext && sameContainer) {
    return {
      context: left.context,
      container: left.container,
      id: unique(left.id, right.id),
      columns: unique(left.columns, right.columns),
    }
  } else {
    return null
  }
}

const unique = <T>(...lists: T[][]) => Array.from(new Set(lists.flat()))
