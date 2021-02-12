import { GraphQLResolveInfo } from 'graphql'
import { IFieldResolver } from 'graphql-tools'
import { GraphQLCosmosContext } from './configuration'

export type ErrorMiddleware = (arg: ErrorDescription) => Promise<unknown> | unknown

export interface ErrorDescription {
  resolver: string
  error: Error
  source: unknown
  args: unknown
  context: GraphQLCosmosContext
  info: GraphQLResolveInfo
}

export const withErrorMiddleware = (
  resolver: string,
  original: IFieldResolver<any, GraphQLCosmosContext>
): IFieldResolver<any, GraphQLCosmosContext> => {
  return async (source, args, context, info) => {
    if (!context.directives.error) {
      return await original(source, args, context, info)
    } else {
      try {
        return await original(source, args, context, info)
      } catch (error) {
        return await context.directives.error({
          resolver,
          source,
          args,
          context,
          info,
          error,
        })
      }
    }
  }
}

export const traceErrorMiddleware = (args: ErrorDescription) => {
  const resolver = args.resolver
  const type = args.info.parentType.name
  const id = JSON.stringify(String(Object(args.source)?.id ?? `<unknown>`))
  const fieldName = args.info.fieldName
  const trace = `during ${resolver} at ${type}(${id}).${fieldName}`
  throw new TraceError(trace, args.error)
}

class TraceError extends Error {
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
