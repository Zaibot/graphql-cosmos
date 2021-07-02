import { GraphQLResolveInfo } from 'graphql'
import { IFieldResolver } from 'graphql-tools'
import { GraphQLCosmosConceptContext } from './6-datasource/1-context'
import { TraceError } from './x-error/trace-error'

export type ErrorMiddleware = (arg: ErrorDescription) => Promise<unknown> | unknown

export interface ErrorDescription {
  resolver: string
  error: Error
  source: unknown
  args: unknown
  context: GraphQLCosmosConceptContext
  info: GraphQLResolveInfo
}

export const withErrorMiddleware = <T extends IFieldResolver<any, GraphQLCosmosConceptContext>>(
  resolver: string,
  original: T
): T => {
  const f: IFieldResolver<any, GraphQLCosmosConceptContext> = async (source, args, context, info) => {
    if (!context.dataSources.graphqlCosmos.onError) {
      return await original(source, args, context, info)
    } else {
      try {
        return await original(source, args, context, info)
      } catch (error) {
        return await context.dataSources.graphqlCosmos.onError({
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
  Object.defineProperty(f, `name`, { value: `withErrorMiddleware(${JSON.stringify(resolver)}, ${original.name})` })
  return f as any
}

export const traceErrorMiddleware = (args: ErrorDescription) => {
  const resolver = args.resolver
  const type = args.info.parentType.name
  const id = JSON.stringify(String(Object(args.source)?.id ?? `<unknown>`))
  const fieldName = args.info.fieldName
  const trace = `during ${resolver} at ${type}(${id}).${fieldName}`
  throw new TraceError(trace, args.error)
}
