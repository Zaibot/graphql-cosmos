import { GraphQLResolveInfo, ResponsePath } from 'graphql/type'
import { GraphQLCosmosRequest } from './configuration'

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
