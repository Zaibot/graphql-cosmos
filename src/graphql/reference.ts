import { DEFAULT } from '../constants'

export interface CosmosTag {
  container?: string
  source?: unknown
  args?: unknown
}

export const hasCosmosTag = <T>(obj: T): obj is T & { __cosmos_tag: CosmosTag } => {
  const tag = Object(obj)?.__cosmos_tag
  return Boolean(tag) && typeof tag === `object`
}
export const getCosmosTagContainer = (obj: unknown): string | null => {
  return Object(obj)?.__cosmos_tag?.container ?? null
}
export const getCosmosTagSource = (obj: unknown): unknown | null => {
  return Object(obj)?.__cosmos_tag?.source ?? null
}
export const getCosmosTagArgs = (obj: unknown): unknown | null => {
  return Object(obj)?.__cosmos_tag?.args ?? null
}

export const ToCosmosTag = (tag: CosmosTag) => <T>(props: T) => {
  return toCosmosTag(tag, props)
}
export const toCosmosTag = <T>(tag: CosmosTag, props: T) => {
  return notNullOrUndefined(props) ? withCosmosTag(tag, props) : null
}
export const withCosmosTag = <T>(tag: CosmosTag, input: T): T & { __cosmos_tag: CosmosTag } => {
  return { ...input, __cosmos_tag: tag }
}

export const ToCosmosReference = <TypeName extends string>(typename: TypeName, container: string) => {
  return (id: string) => toCosmosReference(typename, container, id)
}
export const toCosmosReference = <TypeName extends string>(typename: TypeName, container: string, id: string | null | undefined) => {
  return notNullOrUndefined(id) ? withCosmosReference(typename, container, { [DEFAULT.ID]: id }) : null
}
export const withCosmosReference = <TypeName extends string, T>(typename: TypeName, container: string, input: T): T & { __typename: TypeName; __cosmos_tag: CosmosTag } => {
  return withCosmosTag({ container }, withTypename(typename)(input))
}

export const ToTypename = <TypeName extends string>(typename: TypeName) => {
  return <T>(input: T): T & { __typename: TypeName } => ({ ...input, __typename: typename })
}
export const toTypename = <TypeName extends string>(typename: TypeName, id: string | null | undefined) => {
  return notNullOrUndefined(id) ? withTypename(typename)({ [DEFAULT.ID]: id }) : null
}
export const withTypename = <TypeName extends string>(typename: TypeName) => {
  return <T>(input: T): T & { __typename: TypeName } => ({ ...input, __typename: typename })
}

const notNullOrUndefined = <T>(a: T | null | undefined): a is T => a !== null && a !== undefined
