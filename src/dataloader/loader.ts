import { DataLoaderCombineHandler, defaultOnDataLoaderCombine } from './combine'
import { DataLoaderResolveHandler, defaultOnDataLoaderResolve } from './resolver'
import { DataLoaderSpec } from './spec'

export type DataLoaderHandler = (spec: DataLoaderSpec) => unknown | Promise<unknown>

export interface DataLoaderOptions {
  resolve?: DataLoaderResolveHandler
  combine?: DataLoaderCombineHandler
  batchSize?: number
  interval?: number
}

export const createDataLoader = ({
  resolve = defaultOnDataLoaderResolve,
  combine = defaultOnDataLoaderCombine,
  interval = 10,
  batchSize = 100,
}: DataLoaderOptions): DataLoaderHandler => {
  const pending = new Set<{ promise: ReturnType<typeof createPromise>; spec: DataLoaderSpec }>()

  const combineOrAddPending = (spec: DataLoaderSpec) => {
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

  return (spec: DataLoaderSpec) => {
    const promise = combineOrAddPending(spec)
    queueResolvePending()
    return promise.then((x) => spec.id.map((y) => x.find((z: any) => z.id === y)))
  }
}

const createPromise = () => {
  let resolve!: (r: Array<unknown>) => void
  let reject!: (err: Error) => void

  const promise = new Promise<Array<unknown>>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })

  return { promise, resolve, reject }
}
