export function getObjectId<T extends { id: string | null }>(obj: T | string | null): string | null
export function getObjectId<T extends { id: string }>(obj: T | string): string
export function getObjectId<T extends { id: string | null }>(obj: T | string | null): string | null {
  if (typeof obj === `string`) {
    return obj
  } else if (typeof obj?.id === `string`) {
    return obj.id
  } else {
    return null
  }
}

export function getObjectTypename<T extends { __typename?: string | null }>(obj: T | string | null): string | null
export function getObjectTypename<T extends { __typename: string }>(obj: T | string): string
export function getObjectTypename<T extends { __typename?: string | null }>(obj: T | string | null): string | null {
  if (typeof obj === `string`) {
    return obj
  } else if (typeof obj?.__typename === `string`) {
    return obj.__typename
  } else {
    return null
  }
}
