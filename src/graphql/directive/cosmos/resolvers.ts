import * as GraphQL from 'graphql'
import { pathToArray } from 'graphql/jsutils/Path'
import { GraphQLCosmosContext } from '../../../configuration'
import { DEFAULT } from '../../../constants'
import { debugHooks } from '../../../debug'
import { getCosmosTagContainer, toCosmosReference, toCosmosTag, toTypename } from '../../reference'
import { argsToCosmosCountRequest, argsToCosmosRequest, cosmosResolve, cosmosResolveCount } from '../../resolver/common'
import { resolveCosmosSource } from '../../resolver/resolveWithCosmosSource'

export const resolveRootQuery = (
  theirContainer: string,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (source, args, context, info) => {
  const returnPageTypeCore = GraphQL.getNamedType(fieldType.type) as GraphQL.GraphQLObjectType
  const returnTypeCore = GraphQL.getNamedType(returnPageTypeCore.getFields()['page'].type)
  const graphquery = argsToCosmosRequest(`resolveRootQuery`, [DEFAULT.ID], args, info)
  const result: any = await cosmosResolve(returnTypeCore.name, graphquery, context, theirContainer)
  debugHooks?.onFieldResolved({
    fieldType,
    source,
    result,
  })
  return toCosmosTag(
    { source, args, container: theirContainer },
    {
      ...result,
      async total() {
        const graphquery = argsToCosmosCountRequest(`resolveRootQueryCount`, args, info)
        const result = await cosmosResolveCount(graphquery, context, theirContainer)
        return result
      },
    }
  )
}

export const resolveManyOurs = (
  typeFieldToContainer: Map<string, Map<string, string>>,
  theirContainer: string,
  ours: string | undefined,
  theirs: string | undefined,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (source, args, context, info) => {
  const sourceContainer = getCosmosTagContainer(source) ?? findOwnerContainer(typeFieldToContainer)(info.path)
  const returnPageTypeCore = GraphQL.getNamedType(fieldType.type) as GraphQL.GraphQLObjectType
  const returnTypeCore = GraphQL.getNamedType(returnPageTypeCore.getFields()['page'].type)
  const sourced = await resolveCosmosSource(sourceContainer, DEFAULT.ID, ours ?? fieldType.name, source, context)
  const list = sourced[ours ?? fieldType.name]
  if (Array.isArray(list) && list.length > 0) {
    const whereOurs = `${theirs ?? DEFAULT.ID}_in`
    if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`)
    const where = { ...args.where, [whereOurs]: list }

    const graphquery = argsToCosmosRequest(
      `resolveManyOurs`,
      [DEFAULT.ID],
      {
        ...args,
        where,
      },
      info
    )
    const result: any = await cosmosResolve(returnTypeCore.name, graphquery, context, theirContainer)
    const tagged = toCosmosTag(
      { source: sourced, args, container: sourceContainer },
      {
        ...result,
        async total() {
          const graphquery = argsToCosmosCountRequest(`resolveManyOursCount`, { ...args, where }, info)
          const result = await cosmosResolveCount(graphquery, context, theirContainer)
          return result
        },
      }
    )
    debugHooks?.onFieldResolved({
      fieldType,
      sourceContainer,
      ours,
      theirs,
      source,
      sourced,
      result: tagged,
    })
    return tagged
  } else {
    const tagged = toCosmosTag(
      { source: sourced, args, container: sourceContainer },
      { nextCursor: null, page: [], total: 0 }
    )
    debugHooks?.onFieldResolved({
      fieldType,
      sourceContainer,
      ours,
      theirs,
      source,
      sourced,
      result: tagged,
    })
    return tagged
  }
}

export const resolveManyTheirs = (
  container: string,
  ours: string | undefined,
  theirs: string,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (source, args, context, info) => {
  const returnPageTypeCore = GraphQL.getNamedType(fieldType.type) as GraphQL.GraphQLObjectType
  const returnTypeCore = GraphQL.getNamedType(returnPageTypeCore.getFields()['page'].type)
  const ourId = source[ours ?? DEFAULT.ID]
  const whereTheirs = `${theirs}_in`
  if (whereTheirs in args) throw Error(`argument contains conflicting filter on ${whereTheirs}`)
  const where = { ...args.where, [whereTheirs]: [ourId] }

  const graphquery = argsToCosmosRequest(`resolveManyTheirs`, [DEFAULT.ID], { ...args, where }, info)
  const result: any = await cosmosResolve(returnTypeCore.name, graphquery, context, container)
  debugHooks?.onFieldResolved({
    fieldType,
    source,
    result,
    container,
    ours,
    theirs,
  })
  debugHooks?.onFieldResolved({
    fieldType,
    container,
    ours,
    theirs,
    source,
    result,
  })
  return toCosmosTag(
    { source, args, container },
    {
      ...result,
      async total() {
        const graphquery = argsToCosmosCountRequest(`resolveManyTheirsCount`, { ...args, where }, info)
        const result = await cosmosResolveCount(graphquery, context, container)
        return result
      },
    }
  )
}

export const resolveOneOurs = (
  typeFieldToContainer: Map<string, Map<string, string>>,
  ours: string | undefined,
  container: string,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (source, _args, context, info) => {
  const sourceContainer = getCosmosTagContainer(source) ?? findOwnerContainer(typeFieldToContainer)(info.path)
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  const sourced = await resolveCosmosSource(sourceContainer, DEFAULT.ID, ours ?? fieldType.name, source, context)
  const result = toCosmosReference(returnTypeCore.name, container, sourced[ours ?? fieldType.name])
  debugHooks?.onFieldResolved({
    sourceContainer,
    fieldType,
    source,
    sourced,
    result,
    container,
    ours,
  })
  return result
}

export const resolveOneOursWithoutContainer = (
  ours: string | undefined,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (source, _args, context, _info) => {
  const sourceContainer =
    getCosmosTagContainer(source) ?? fail(`container not specified for ${pathToArray(_info.path).join(`/`)}`)
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  const sourced = await resolveCosmosSource(sourceContainer, DEFAULT.ID, ours ?? fieldType.name, source, context)
  const result = toTypename(returnTypeCore.name, sourced[ours ?? fieldType.name])
  debugHooks?.onFieldResolved({
    sourceContainer,
    fieldType,
    source,
    sourced,
    result,
    ours,
  })
  return result
}

export const resolveManyOursWithoutContainer = (
  ours: string | undefined,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (source, _args, context, _info) => {
  const sourceContainer =
    getCosmosTagContainer(source) ?? fail(`container not specified for ${pathToArray(_info.path).join(`/`)}`)
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  const sourced = await resolveCosmosSource(sourceContainer, DEFAULT.ID, ours ?? fieldType.name, source, context)
  // TODO: sourced[ours] type validation
  const result = sourced[ours ?? fieldType.name]?.map((id: unknown) => toTypename(returnTypeCore.name, String(id)))
  debugHooks?.onFieldResolved({
    sourceContainer,
    fieldType,
    source,
    sourced,
    result,
    ours,
  })
  return result
}

function fail(message: string) {
  throw Error(message)
}

export const resolveOneTheirs = (
  container: string,
  ours: string | undefined,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (source, _args, context, info) => {
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  const sourced = await resolveCosmosSource(container, DEFAULT.ID, ours ?? fieldType.name, source, context)
  const result = toCosmosReference(returnTypeCore.name, container, sourced[ours ?? info.fieldName])
  debugHooks?.onFieldResolved({
    fieldType,
    source,
    sourced,
    result,
    container,
    ours,
  })
  return result
}

const findOwnerContainer = (data: Map<string, Map<string, string>>) => (path: GraphQL.ResponsePath) => {
  return pathList(path)
    .map((p) => typeof p.typename === `string` && typeof p.key === `string` && data.get(p.typename)?.get(p.key))
    .slice(1)
    .find((x): x is string => typeof x === `string`)
}

const pathList = (path?: GraphQL.ResponsePath) => {
  const entries: { typename: string | undefined; key: string | number }[] = []
  for (let current = path; current; current = current.prev) {
    entries.push({ typename: current.typename, key: current.key })
  }
  return entries
}
