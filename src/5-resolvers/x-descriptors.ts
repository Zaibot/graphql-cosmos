export namespace SourceDescriptor {
  export type Embedded<T> = T & { __descriptor: Single | List }

  export function withDescriptor<T>(values: T, descriptor: Single | List): Embedded<T> {
    return { ...values, __descriptor: descriptor }
  }

  export function WithDescriptor<T>(descriptor: Single | List): (values: T) => Embedded<T> {
    return (values) => ({ ...values, __descriptor: descriptor })
  }

  export function hasDescriptor<T>(embedded: T): embedded is Embedded<T> {
    return (
      typeof embedded === `object` &&
      '__descriptor' in embedded &&
      typeof (embedded as any).__descriptor.kind === `string`
    )
  }

  export function getDescriptor<T extends Embedded<unknown>>(embedded: T): Single | List
  export function getDescriptor<T>(embedded: T): Single | List | null
  export function getDescriptor<T>(embedded: T): Single | List | null {
    return hasDescriptor(embedded) ? embedded.__descriptor : null
  }

  export interface Single {
    kind: `Single`
    typename: string
    database: string
    container: string
    id: string
  }

  export interface List {
    kind: `List`
    typename: string
    database: string
    container: string
    id: string
  }
}
