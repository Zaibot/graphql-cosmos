import { CosmosQueryHandler } from './configuration'
import { SqlOpScalar } from './sql/op'

export interface GraphQLCosmosDataLoaderSpec {
  database: string
  container: string
  id: SqlOpScalar[]
  columns: string[]
}

export type GraphQLCosmosDataLoaderResolver = (spec: GraphQLCosmosDataLoaderSpec) => unknown | Promise<unknown>

export const combineDataLoaderSpec = (
  left: GraphQLCosmosDataLoaderSpec,
  right: GraphQLCosmosDataLoaderSpec
): GraphQLCosmosDataLoaderSpec | null => {
  const sameDatabase = left.database === right.database
  const sameContainer = left.container === right.container
  if (sameDatabase && sameContainer) {
    return {
      database: left.database,
      container: left.container,
      id: unique(left.id, right.id),
      columns: unique(left.columns, right.columns),
    }
  } else {
    return null
  }
}

export const handleDataLoaderQuery = async (onQuery: CosmosQueryHandler, spec: GraphQLCosmosDataLoaderSpec) => {
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

export const createDataLoader = (onQuery: CosmosQueryHandler) => {
  const pending = new Set<{ promise: ReturnType<typeof createPromise>; spec: GraphQLCosmosDataLoaderSpec }>()

  const combine = (spec: GraphQLCosmosDataLoaderSpec) => {
    for (const p of pending) {
      const c = combineDataLoaderSpec(p.spec, spec)
      if (c) {
        // Matching entry found
        pending.delete(p)
        pending.add({ promise: p.promise, spec: c })
        return p.promise.promise
      }
    }
    // No matching entry found
    const n = createPromise()
    pending.add({ promise: n, spec })
    return n.promise
  }
  let timer: any = null
  const queueResolve = () => {
    if (!timer) {
      timer = setTimeout(() => {
        timer = null
        resolvePending()
      }, 100)
    }
  }
  const resolvePending = () => {
    const queued = Array.from(pending)
    pending.clear()

    queued.forEach(async ({ spec, promise }) => {
      try {
        const response = await handleDataLoaderQuery(onQuery, spec)
        promise.resolve(response)
      } catch (ex) {
        promise.reject(ex)
      }
    })
  }

  return (spec: GraphQLCosmosDataLoaderSpec) => {
    const p = combine(spec)
    queueResolve()
    return p.then((x) => spec.id.map((y) => x.find((z) => z.id === y)))
  }
}
interface DataLoaderResult {
  id: string
}
const createPromise = () => {
  let resolve!: (r: Array<DataLoaderResult>) => void
  let reject!: (err: Error) => void

  const promise = new Promise<Array<DataLoaderResult>>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  return { promise, resolve, reject }
}

const unique = <T>(...lists: T[][]) => Array.from(new Set(lists.flat()))
