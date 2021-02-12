export function getId(input: string): string
export function getId(input: string | null | undefined): string | null
export function getId(input: { id: string }): string
export function getId(input: { id?: string | null | undefined } | null | undefined): string | null
export function getId(input: unknown): string | null
export function getId(input: { id?: unknown } | null | undefined): string | null
export function getId(input: unknown): string | null {
  if (typeof input === `object`) {
    input = Object(input).id
  }

  if (typeof input === `string`) {
    return input
  } else if (input === null || input === undefined) {
    return null
  } else {
    throw Error(`expects id to be of type string`)
  }
}

export function getTypename(input: { __typename: string }): string
export function getTypename(input: { __typename?: string | null | undefined } | null | undefined): string | null
export function getTypename(input: unknown | null | undefined): string | null
export function getTypename(input: unknown): string | null {
  if (typeof input === `object`) {
    input = Object(input).__typename
  }

  if (typeof input === `string`) {
    return input
  } else if (input === null || input === undefined) {
    return null
  } else {
    throw Error(`expects __typename to be of type string`)
  }
}
