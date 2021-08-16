import { FeedResponse } from '@azure/cosmos'
import { GraphQLCosmosPageOutput } from '../../4-resolver-builder/3-typedefs-transformer'
import { Lazy } from '../../typescript'
import { SourceDescriptor } from '../x-descriptors'

export const emptyPageResponse: GraphQLCosmosPageOutput<any> = {
  cursor: null,
  nextCursor: null,
  page: [],
  total: 0,
}

export function graphqlCosmosPageResponse<T extends { id: string }>(
  cursor: string | null,
  query: Lazy<Promise<FeedResponse<T>>>,
  count: Lazy<Promise<FeedResponse<number>>>,
  transformer: (item: T) => SourceDescriptor.Embedded<T>
): GraphQLCosmosPageOutput<T> {
  return {
    cursor: cursor,
    nextCursor: () => query().then((x) => x.continuationToken),
    page: () => query().then((x) => (x.resources ?? []).map(transformer)),
    total: () => count().then((x) => x.resources[0]),
  }
}
