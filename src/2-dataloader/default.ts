import { createDataLoader, DataLoaderHandler } from './loader'

export const defaultDataLoader = (): DataLoaderHandler => {
  const loader = createDataLoader({})
  return loader
}
