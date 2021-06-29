import { GraphQLResolveInfo } from 'graphql'

export type PromiseOrValue<T> = Promise<T> | T

export function fail(msg: string): never {
  throw Error(msg)
}

export function failql(msg: string, info: GraphQLResolveInfo): never {
  throw Error(`${msg} (${info.parentType.name}.${info.fieldName})`)
}

export interface Lazy<T> {
  (): T
}

export const lazy = <T>(fn: () => T): Lazy<T> => {
  let current = (): T => {
    const val = fn()
    current = () => val
    return val
  }

  return () => current()
}
