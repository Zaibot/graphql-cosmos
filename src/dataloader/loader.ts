import { DataLoaderCombineHandler, defaultOnDataLoaderCombine } from './combine'
import { DataLoaderResolveHandler } from './resolver'
import { DataLoaderSpec } from './spec'

export type DataLoaderHandler<GraphQLContext> = (spec: DataLoaderSpec<GraphQLContext>) => unknown | Promise<unknown>

export interface DataLoaderOptions<GraphQLContext> {
  resolve: DataLoaderResolveHandler<GraphQLContext>
  combine?: DataLoaderCombineHandler<GraphQLContext>
  batchSize?: number
  interval?: number
}

export const createDataLoader = <GraphQLContext>({
  resolve,
  combine = defaultOnDataLoaderCombine,
  interval = 10,
  batchSize = 100,
}: DataLoaderOptions<GraphQLContext>): DataLoaderResolveHandler<GraphQLContext> => {
  const pending = new Set<{ promise: ReturnType<typeof createPromise>; spec: DataLoaderSpec<GraphQLContext> }>()

  const combineOrAddPending = (spec: DataLoaderSpec<GraphQLContext>) => {
    for (const p of pending) {
      if (p.spec.id.length > batchSize) {
        // Should not attempt this bucket
        continue
      }
      const c = combine(p.spec, spec)
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

  const resolvePending = () => {
    const queued = Array.from(pending)
    pending.clear()

    queued.forEach(async ({ spec, promise }) => {
      try {
        const response = await resolve(spec)
        promise.resolve(response)
      } catch (ex) {
        promise.reject(ex)
      }
    })
  }

  let timer: any = null
  const queueResolvePending = () => {
    if (!timer) {
      timer = setTimeout(() => {
        timer = null
        resolvePending()
      }, interval)
    }
  }

  return (spec: DataLoaderSpec<GraphQLContext>) => {
    const promise = combineOrAddPending(spec)
    queueResolvePending()
    return promise.then((x) => spec.id.map((y) => x.find((z) => z.id === y)))
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
