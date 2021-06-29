export class TraceError extends Error {
  readonly original: Error
  readonly fullTrace: string

  constructor(trace: string, error: Error) {
    if (error instanceof TraceError) {
      const fullTrace = `${error.fullTrace}\n| ${trace}`

      super(TraceError.message(fullTrace, error.original))
      this.original = error.original
      this.fullTrace = fullTrace
    } else {
      const firstTrace = `${trace}`

      super(TraceError.message(firstTrace, error))
      this.original = error
      this.fullTrace = firstTrace
    }
  }

  private static message(trace: string, error: Error): string | undefined {
    return `${trace}\n\n${error.stack ?? error.message}`
  }
}
