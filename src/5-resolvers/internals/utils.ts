import { FeedResponse } from '@azure/cosmos'
import { GraphQLCosmosPageOutput } from '../../4-resolver-builder/3-schema-transformer'
import { Lazy } from '../../typescript'
import { SourceDescriptor } from '../x-descriptors'

export const emptyPageResponse: GraphQLCosmosPageOutput = {
  page: [],
  cursor: null,
  nextCursor: null,
  total: 0,
}

export function graphqlCosmosPageResponse(
  typename: string,
  database: string,
  container: string,
  cursor: string | null,
  query: Lazy<Promise<FeedResponse<{ id: string }>>>,
  count: Lazy<Promise<FeedResponse<number>>>
): GraphQLCosmosPageOutput {
  return {
    get page() {
      return query().then((feed) => feed.resources.map(wrapSingleSourceDescriptor(typename, database, container)))
    },
    get cursor() {
      return Promise.resolve(cursor)
    },
    get nextCursor() {
      return query().then((x) => x.continuationToken)
    },
    get total() {
      return count().then((x) => x.resources[0])
    },
  }
}

export function wrapSingleSourceDescriptor(typename: string, database: string, container: string) {
  // TODO, use refSingle of datasource
  return (item: { id: string }) =>
    SourceDescriptor.withDescriptor(item, {
      kind: `Single`,
      database,
      container,
      typename,
      id: item.id,
    })
}
