import * as GraphQL from 'graphql'
import { GraphQLCosmosContext } from '../../../configuration'
import { DEFAULT_ID } from '../../../constants'
import { getCosmosTagContainer, toCosmosReference, toCosmosTag } from '../../reference'
import {
  argsToCosmosCountRequest,
  argsToCosmosRequest as argsToCosmosArrayRequest,
  cosmosResolve,
  cosmosResolveCount,
} from '../../resolver/common'
import { resolveCosmosSource, resolveWithCosmosSource } from '../../resolver/resolveWithCosmosSource'

export const resolveRootQuery = (
  container: string,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (_s, a, context, _i) => {
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  const graphquery = argsToCosmosArrayRequest(`resolveRootQuery`, [DEFAULT_ID], a, _i)
  const result: any = await cosmosResolve(returnTypeCore.name, graphquery, context, container)
  return toCosmosTag(
    { source: _s, args: a, container: container },
    {
      ...result,
      async total() {
        const graphquery = argsToCosmosCountRequest(`resolveRootQueryCount`, a, _i)
        const result = await cosmosResolveCount(graphquery, context, container)
        return result
      },
    }
  )
}

export const resolveSourceField = resolveWithCosmosSource

export const resolveManyOurs = (
  typeFieldToContainer: Map<string, Map<string, string>>,
  container: string,
  ours: string | undefined,
  theirs: string | undefined,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (s, a, c, i) => {
  const objectContainer = getCosmosTagContainer(s) ?? findOwnerContainer(typeFieldToContainer)(i.path)
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  const source = await resolveCosmosSource(objectContainer, DEFAULT_ID, ours ?? fieldType.name, s, c)
  const args = a
  const context = c
  const list = source[ours ?? fieldType.name]
  if (Array.isArray(list) && list.length > 0) {
    const whereOurs = `${theirs ?? DEFAULT_ID}_in`
    if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`)
    const where = { ...args.where, [whereOurs]: list }

    const graphquery = argsToCosmosArrayRequest(
      `resolveManyOurs`,
      [DEFAULT_ID],
      {
        ...args,
        where,
      },
      i
    )
    const result: any = await cosmosResolve(returnTypeCore.name, graphquery, context, container)
    const tagged = toCosmosTag(
      { source: source, args: a, container: objectContainer },
      {
        ...result,
        async total(_source: any, context: GraphQLCosmosContext, _info: GraphQL.GraphQLResolveInfo) {
          const graphquery = argsToCosmosCountRequest(`resolveManyOursCount`, { ...args, where }, i)
          const result = await cosmosResolveCount(graphquery, context, container)
          return result
        },
      }
    )
    return tagged
  } else {
    const tagged = toCosmosTag(
      { source: source, args: a, container: objectContainer },
      { nextCursor: null, page: [], total: 0 }
    )
    return tagged
  }
}

export const resolveManyTheirs = (
  container: string,
  ours: string | undefined,
  theirs: string,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (s, a, context, i) => {
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  const ourId = s[ours ?? DEFAULT_ID]
  const whereTheirs = `${theirs}_in`
  if (whereTheirs in a) throw Error(`argument contains conflicting filter on ${whereTheirs}`)
  const where = { ...a.where, [whereTheirs]: [ourId] }

  const graphquery = argsToCosmosArrayRequest(`resolveManyTheirs`, [DEFAULT_ID], { ...a, where }, i)
  const result: any = await cosmosResolve(returnTypeCore.name, graphquery, context, container)
  return toCosmosTag(
    { source: s, args: a, container },
    {
      ...result,
      async total(_source: any) {
        const graphquery = argsToCosmosCountRequest(`resolveManyTheirsCount`, { ...a, where }, i)
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
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (s, a, c, i) => {
  const objectContainer = getCosmosTagContainer(s) ?? findOwnerContainer(typeFieldToContainer)(i.path)
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  return await resolveWithCosmosSource(
    objectContainer,
    DEFAULT_ID,
    ours ?? fieldType.name,
    async (source, _args, _context: GraphQLCosmosContext, _info) => {
      const result = toCosmosReference(returnTypeCore.name, container, source[ours ?? fieldType.name])
      return result
    }
  )(s, a, c, i)
}

export const resolveOneOursWithoutContainer = (
  typeFieldToContainer: Map<string, Map<string, string>>,
  ours: string | undefined,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (source, _args, _context, _info) => {
  const objectContainer = getCosmosTagContainer(source) ?? findOwnerContainer(typeFieldToContainer)(_info.path)
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  const sourced = await resolveCosmosSource(objectContainer, DEFAULT_ID, ours ?? fieldType.name, source, _context)
  const result = toCosmosReference(returnTypeCore.name, objectContainer, sourced[ours ?? fieldType.name])
  return result
}

export const resolveOneTheirs = (
  container: string,
  ours: string | undefined,
  fieldType: GraphQL.GraphQLField<any, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => async (s, a, c, i) => {
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  return await resolveWithCosmosSource(
    container,
    DEFAULT_ID,
    ours ?? fieldType.name,
    async (source, _args, _context: GraphQLCosmosContext, info) => {
      const result = toCosmosReference(returnTypeCore.name, container, source[ours ?? info.fieldName])
      return result
    }
  )(s, a, c, i)
}

export const findOwnerContainer = (data: Map<string, Map<string, string>>) => (path: GraphQL.ResponsePath) => {
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
