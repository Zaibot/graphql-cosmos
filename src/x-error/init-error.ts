export class GraphQLCosmosInitError extends Error {
  public readonly originalError: Error

  constructor(message: string, originalError: Error) {
    super(message + `\n- ` + originalError.message)
    this.originalError = originalError
  }
}
