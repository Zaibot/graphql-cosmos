import { FeedResponse } from '@azure/cosmos'
import { DataSourceQuery, DataSourceQueryResponse } from './4-query'

export interface GraphQLCosmosDataSourcePlugin {
  onBeforeBuildQuery(query: DataSourceQuery): void
  onAfterBuildQuery(query: DataSourceQueryResponse): void
  onBeforeBuildCountQuery(query: DataSourceQuery): void
  onAfterBuildCountQuery(query: DataSourceQueryResponse): void
  onBeforeQuery(query: DataSourceQueryResponse): void
  onAfterQuery(query: DataSourceQueryResponse, response: FeedResponse<unknown>): void
}
export const combineDataSourcePlugins = (
  plugins: Array<Partial<GraphQLCosmosDataSourcePlugin>>
): GraphQLCosmosDataSourcePlugin => {
  const reversed = plugins.slice().reverse()
  return {
    onBeforeBuildQuery(query) {
      for (const plugin of plugins) {
        plugin.onBeforeBuildQuery?.(query)
      }
    },
    onAfterBuildQuery(query) {
      for (const plugin of reversed) {
        plugin.onAfterBuildQuery?.(query)
      }
    },
    onBeforeBuildCountQuery(query) {
      for (const plugin of plugins) {
        plugin.onBeforeBuildCountQuery?.(query)
      }
    },
    onAfterBuildCountQuery(query) {
      for (const plugin of reversed) {
        plugin.onAfterBuildCountQuery?.(query)
      }
    },
    onBeforeQuery(query) {
      for (const plugin of plugins) {
        plugin.onBeforeQuery?.(query)
      }
    },
    onAfterQuery(query, response) {
      for (const plugin of reversed) {
        plugin.onAfterQuery?.(query, response)
      }
    },
  }
}
