export interface ApolloDataSourceConfig<TContext> {
  context: TContext
  cache?: ApolloKeyValueCache
}

export interface ApolloKeyValueCacheSetOptions {
  /**
   * Specified in **seconds**, the time-to-live (TTL) value limits the lifespan
   * of the data being stored in the cache.
   */
  ttl?: number | null
}

export interface ApolloKeyValueCache<V = string> {
  get(key: string): Promise<V | undefined>
  set(key: string, value: V, options?: ApolloKeyValueCacheSetOptions): Promise<void>
  delete(key: string): Promise<boolean | void>
}

export abstract class ApolloDataSource<TContext = any> {
  initialize?(config: ApolloDataSourceConfig<TContext>): void | Promise<void>
}
