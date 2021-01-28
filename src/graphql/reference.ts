import { DEFAULT } from '../constants'
import { SqlOpScalar } from '../sql/op'

export interface CosmosTag {
  container?: string
  source?: any
  args?: any
}

export const getCosmosTagContainer = (obj: any): string => {
  return obj && obj.__cosmos_tag ? obj.__cosmos_tag.container : null
}

export const getCosmosTagSource = (obj: any): unknown => {
  return obj && obj.__cosmos_tag ? obj.__cosmos_tag.source : null
}

export const getCosmosTagArgs = (obj: any): unknown => {
  return obj && obj.__cosmos_tag ? obj.__cosmos_tag.args : null
}

export const ToCosmosTag = (tag: CosmosTag) => <T>(props: T) => toCosmosTag(tag, props)
export const toCosmosTag = <T extends {}>(tag: CosmosTag, props: T) =>
  notNullOrUndefined(props) ? withCosmosTag(tag, props) : null
export const withCosmosTag = <T extends {}>(tag: CosmosTag, input: T): T & { __cosmos_tag: CosmosTag } => {
  return { ...input, __cosmos_tag: tag }
}

export const ToCosmosReference = <TypeName extends string>(typename: TypeName, container: string) => <
  ID extends SqlOpScalar
>(
  id: ID
) => toCosmosReference(typename, container, id)
export const toCosmosReference = <TypeName extends string, ID extends SqlOpScalar>(
  typename: TypeName,
  container: string,
  id: ID | null | undefined
) => (notNullOrUndefined(id) ? withCosmosReference(typename, container, { [DEFAULT.ID]: id }) : null)
export const withCosmosReference = <TypeName extends string, T extends {}>(
  typename: TypeName,
  container: string,
  input: T
): T & { __typename: TypeName; __cosmos_tag: CosmosTag } => {
  return withCosmosTag({ container }, withTypename(typename)(input))
}

export const withTypename = <TypeName extends string>(typename: TypeName) => <T>(
  input: T
): T & { __typename: TypeName } => ({
  ...input,
  __typename: typename,
})
export const toTypename = <TypeName extends string, ID extends SqlOpScalar>(
  typename: TypeName,
  id: ID | null | undefined
) => (notNullOrUndefined(id) ? withTypename(typename)({ [DEFAULT.ID]: id }) : null)

const notNullOrUndefined = <T>(a: T | null | undefined): a is T => a !== null && a !== undefined
