export class GraphQLCosmosFieldResolverError extends Error {
  public readonly originalError: Error
  public readonly parent: unknown

  constructor(message: string, originalError: Error, parent: unknown) {
    super(message)
    this.originalError = originalError
    this.parent = parent
  }
}
