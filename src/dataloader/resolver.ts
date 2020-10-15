import { CosmosQueryHandler } from '../configuration'
import { DataLoaderSpec } from './spec'

export type DataLoaderResolveHandler = (spec: DataLoaderSpec) => Promise<Array<any>>

export const defaultOnDataLoaderResolve = (onQuery: CosmosQueryHandler): DataLoaderResolveHandler => async (
  spec: DataLoaderSpec
) => {
  const idList = unique(spec.id)
  const columnList = unique(spec.columns)
  const select = columnList.length ? [`id`, ...columnList].map((x) => `r.${x}`).join(`, `) : `*`
  const query = await onQuery({
    client: null as any,
    database: spec.database,
    container: spec.container,
    query: `SELECT ${select} FROM r WHERE ARRAY_CONTAINS(@batch, r.id)`,
    parameters: [{ name: `@batch`, value: idList }],
  })
  return query.resources
}

const unique = <T>(...lists: T[][]) => Array.from(new Set(lists.flat()))
