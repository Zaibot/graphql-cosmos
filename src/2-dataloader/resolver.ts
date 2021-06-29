import { DataLoaderSpec } from './spec'

export type DataLoaderResolveHandler = (spec: DataLoaderSpec) => Promise<Array<unknown>>

export const defaultOnDataLoaderResolve: DataLoaderResolveHandler = async (
  spec: DataLoaderSpec
): Promise<Array<unknown>> => {
  const whereIds = unique(spec.id)
  const selectColumns = unique([`id`].concat(spec.columns))

  if (whereIds.length > 100) {
    /*TODO*/ fail(`cosmos seems to limit array filters to 100 TODO`)
  }

  const build = spec.context.dataSources.graphqlCosmos.buildQuery({
    container: spec.container,
    context: spec.context,
    cursor: null,
    database: spec.database,
    fields: selectColumns,
    limit: null,
    origin: null,
    sort: [],
    typename: spec.typename,
    where: [{ in: [`id`, whereIds] }],
  })

  const response = await spec.context.dataSources.graphqlCosmos.query(build)
  return response.resources
}

const unique = <T>(...lists: T[][]) => Array.from(new Set(lists.flat()))
