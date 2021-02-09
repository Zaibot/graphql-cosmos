import { FieldNode } from 'graphql'
import { GraphQLField, GraphQLObjectType, GraphQLResolveInfo, ResponsePath } from 'graphql/type'
import { GraphQLCosmosContext, GraphQLCosmosInitRequest, GraphQLCosmosRequest } from './configuration'

export const cosmosRequestToDebugString = ({ query, parameters, init }: GraphQLCosmosRequest) => {
  const key = parameters.length ? `${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString()})` : query
  return JSON.stringify(
    {
      container: init?.container,
      key,
      resolver: init?.request.resolverDescription,
      init: init?.request.graphqlInfo ? pathToString(init.request.graphqlInfo) : null,
    },
    undefined,
    2
  )
}

export const cosmosInitRequestToDebugString = ({ query, parameters, request, container }: GraphQLCosmosInitRequest) => {
  const key = parameters?.length ? `${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString()})` : query
  return JSON.stringify(
    {
      container: container,
      key,
      resolver: request.resolverDescription,
      init: request.graphqlInfo ? pathToString(request.graphqlInfo) : null,
    },
    undefined,
    2
  )
}

export const resolveInfoToDebugString = (info: GraphQLResolveInfo) => {
  return JSON.stringify(
    {
      operationName: info.operation.name?.value ?? `-`,
      path: pathToString(info),
      rootValue: info.rootValue ?? null,
      fragments: Object.keys(info.fragments),
      fieldNodes: Object.fromEntries(
        info.fieldNodes.map((x) => [
          x.name.value,
          x.selectionSet?.selections.map((y) => (y as Partial<FieldNode>).name?.value),
        ])
      ),
    },
    undefined,
    2
  )
}

const pathToString = (info: GraphQLResolveInfo) => {
  return {
    operation: info.operation.name?.value,
    field: info.fieldName,
    path: pathList(info.path)
      .map((x) => (x.typename ? `${x.typename}.${x.key}` : x.key))
      .reverse()
      .join(`/`),
  }
}

const pathList = (path?: ResponsePath) => {
  const entries: { typename: string | undefined; key: string | number }[] = []
  for (let current = path; current; current = current.prev) {
    entries.push({ typename: current.typename, key: current.key })
  }
  return entries
}

export interface DebugHooks {
  onResolverSet?: (args: {
    resolver: string
    objectType: GraphQLObjectType<any, any>
    fieldType: GraphQLField<
      any,
      any,
      {
        [key: string]: any
      }
    >
  }) => void
  onFieldResolved?: (args: {
    fieldType: GraphQLField<any, GraphQLCosmosContext>
    sourceContainer?: string
    theirsContainer?: string
    container?: string
    ours?: string
    theirs?: string
    source: any
    sourced?: any
    result: any
  }) => void
}

export let debugHooks: DebugHooks = {}
