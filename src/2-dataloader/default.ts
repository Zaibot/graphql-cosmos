import { createDataLoader, DataLoaderHandler } from './loader'
import { defaultOnDataLoaderResolve } from './resolver'

export const defaultDataLoader = (): DataLoaderHandler => {
  const loader = createDataLoader({ resolve: defaultOnDataLoaderResolve })
  return loader
}
