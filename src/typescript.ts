import { GraphQLResolveInfo } from 'graphql'

export type PromiseOrValue<T> = Promise<T> | T

export function defined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

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

export const unique = <T>(...lists: T[][]) => Array.from(new Set(lists.flat()))

export const valueIfOne = <T>(list: T[]) => (list.length < 2 ? list[0] : list)

// export function unique<T>(array: T[]) {
//   return Array.from(new Set(array).values())
// }
