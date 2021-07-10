import { fail, unique, valueIfOne } from '../typescript'
import { DataLoaderSpec } from './spec'

export type DataLoaderResolveHandler = (spec: DataLoaderSpec) => Promise<Array<unknown>>

export const defaultOnDataLoaderResolve: DataLoaderResolveHandler = async (
  spec: DataLoaderSpec
): Promise<Array<unknown>> => {
  const graphqlCosmos = spec.context.dataSources.graphqlCosmos
  const whereIds = valueIfOne(unique(spec.id))
  const selectColumns = unique([`id`].concat(spec.columns))

  if (whereIds.length > 100) {
    /*TODO*/ fail(`cosmos seems to limit array filters to 100 TODO`)
  }

  const build = graphqlCosmos.buildQuery({
    container: spec.container,
    context: spec.context,
    cursor: null,
    database: spec.database,
    fields: selectColumns,
    limit: null,
    origin: null,
    sort: [],
    typename: spec.typename,
    where: Array.isArray(whereIds) ? [{ in: [`id`, whereIds] }] : [{ eq: [`id`, whereIds] }],
  })

  const response = await graphqlCosmos.query(build)
  return response.resources
}
