import * as GraphQL from 'graphql'
import { pathToArray } from 'graphql/jsutils/Path'
import { GraphQLCosmosContext } from '../../../configuration'
import { DEFAULT } from '../../../constants'
import { debugHooks } from '../../../debug'
import { hasCosmosTag, toCosmosReference, toCosmosTag, toTypename } from '../../reference'
import { argsToCosmosCountRequest, argsToCosmosRequest, cosmosResolve, cosmosResolveCount } from '../../resolver/common'
import { hasId, requireCosmosColumn } from '../../resolver/requireCosmosColumn'
import { cosmosContainerByResolveInfo } from '../ast'

export const resolveRootQuery = (
  theirContainer: string,
  fieldType: GraphQL.GraphQLField<unknown, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<unknown, GraphQLCosmosContext> => async (source, args, context, info) => {
  const returnPageTypeCore = GraphQL.getNamedType(fieldType.type) as GraphQL.GraphQLObjectType
  const returnTypeCore = GraphQL.getNamedType(returnPageTypeCore.getFields()['page'].type)
  const graphquery = argsToCosmosRequest(`resolveRootQuery`, [DEFAULT.ID], args, info)
  const result = await cosmosResolve(returnTypeCore.name, graphquery, context, theirContainer)
  debugHooks?.onFieldResolved?.({
    fieldType,
    source,
    result,
  })
  return toCosmosTag(
    { source, args, container: theirContainer },
    {
      ...Object(result),
      async total() {
        const graphquery = argsToCosmosCountRequest(`resolveRootQueryCount`, args, info)
        const result = await cosmosResolveCount(graphquery, context, theirContainer)
        return result
      },
    }
  )
}

export const resolveManyOurs = (
  theirContainer: string,
  ours: string | undefined,
  theirs: string | undefined,
  fieldType: GraphQL.GraphQLField<unknown, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<unknown, GraphQLCosmosContext> => async (source, args, context, info) => {
  const returnPageTypeCore = GraphQL.getNamedType(fieldType.type) as GraphQL.GraphQLObjectType
  const returnTypeCore = GraphQL.getNamedType(returnPageTypeCore.getFields()['page'].type)
  if (hasCosmosTag(source) && hasId(source)) {
    const container = cosmosContainerByResolveInfo(info)!
    const column = ours ?? fieldType.name
    const sourced = await requireCosmosColumn(source, column, context)
    const theirId = sourced[column] ?? []
    if (Array.isArray(theirId) && theirId.every((x) => typeof x === `string`)) {
      const whereOurs = `${theirs ?? DEFAULT.ID}_in`
      if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`)
      const where = { ...args.where, [whereOurs]: theirId }

      const graphquery = argsToCosmosRequest(
        `resolveManyOurs`,
        [DEFAULT.ID],
        {
          ...args,
          where,
        },
        info
      )
      const result = await cosmosResolve(returnTypeCore.name, graphquery, context, container)
      const tagged = toCosmosTag(
        { ...source.__cosmos_tag, source: sourced },
        {
          ...Object(result),
          async total() {
            const graphquery = argsToCosmosCountRequest(`resolveManyOursCount`, { ...args, where }, info)
            const result = await cosmosResolveCount(graphquery, context, theirContainer)
            return result
          },
        }
      )
      debugHooks?.onFieldResolved?.({
        fieldType,
        ours,
        theirs,
        source,
        sourced,
        result: tagged,
      })
      return tagged
    } else {
      const result = toCosmosTag({ container }, { nextCursor: null, page: [], total: 0 })
      return result
    }
  } else {
    // No tag, we can not resolve the information by fetching...
    const container = cosmosContainerByResolveInfo(info)
    if (container) {
      const column = ours ?? fieldType.name
      const id = Object(source)[column] ?? []
      const result = id.map((id: any) => toCosmosReference(returnTypeCore.name, container, id))
      const tagged = toCosmosTag({ container }, { nextCursor: null, page: result, total: result.length })
      return tagged
    } else {
      throw Error(
        `resolveOneOurs: source for ${returnTypeCore.name} not able to determine container: ${pathToArray(
          info.path
        ).join(`/`)}`
      )
    }
  }
}

export const resolveManyTheirs = (
  container: string,
  ours: string | undefined,
  theirs: string,
  fieldType: GraphQL.GraphQLField<unknown, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<unknown, GraphQLCosmosContext> => async (source, args, context, info) => {
  const returnPageTypeCore = GraphQL.getNamedType(fieldType.type) as GraphQL.GraphQLObjectType
  const returnTypeCore = GraphQL.getNamedType(returnPageTypeCore.getFields()['page'].type)
  if (hasCosmosTag(source) && hasId(source)) {
    const column = ours ?? DEFAULT.ID
    const sourced = await requireCosmosColumn(source, column, context)
    const ourId = sourced[column]
    const whereTheirs = `${theirs}_in`
    if (whereTheirs in args) throw Error(`argument contains conflicting filter on ${whereTheirs}`)
    const where = { ...args.where, [whereTheirs]: [ourId] }

    const graphquery = argsToCosmosRequest(`resolveManyTheirs`, [DEFAULT.ID], { ...args, where }, info)
    const result = await cosmosResolve(returnTypeCore.name, graphquery, context, container)
    debugHooks?.onFieldResolved?.({
      fieldType,
      source,
      result,
      container,
      ours,
      theirs,
    })
    return toCosmosTag(
      { source, args, container },
      {
        ...Object(result),
        async total() {
          const graphquery = argsToCosmosCountRequest(`resolveManyTheirsCount`, { ...args, where }, info)
          const result = await cosmosResolveCount(graphquery, context, container)
          return result
        },
      }
    )
  } else {
    const column = ours ?? DEFAULT.ID
    const ourId = Object(source)[column]
    const whereTheirs = `${theirs}_in`
    if (whereTheirs in args) throw Error(`argument contains conflicting filter on ${whereTheirs}`)
    const where = { ...args.where, [whereTheirs]: [ourId] }

    const graphquery = argsToCosmosRequest(`resolveManyTheirs`, [DEFAULT.ID], { ...args, where }, info)
    const result = await cosmosResolve(returnTypeCore.name, graphquery, context, container)
    debugHooks?.onFieldResolved?.({
      fieldType,
      source,
      result,
      container,
      ours,
      theirs,
    })
    return toCosmosTag(
      { source, args, container },
      {
        ...Object(result),
        async total() {
          const graphquery = argsToCosmosCountRequest(`resolveManyTheirsCount`, { ...args, where }, info)
          const result = await cosmosResolveCount(graphquery, context, container)
          return result
        },
      }
    )
  }
}

export const resolveOneOurs = (
  ours: string | undefined,
  fieldType: GraphQL.GraphQLField<unknown, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<unknown, GraphQLCosmosContext> => async (source, _args, context, info) => {
  const container = cosmosContainerByResolveInfo(info)!
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  if (hasCosmosTag(source) && hasId(source)) {
    const column = ours ?? fieldType.name
    const sourced = await requireCosmosColumn(source, column, context)
    const theirId = sourced[column]
    if (theirId !== null && theirId !== undefined && typeof theirId !== `string`) {
      throw Error(
        `resolveOneOurs: source for ${returnTypeCore.name} not of type string: ${pathToArray(info.path).join(`/`)}`
      )
    }
    const result = container
      ? toCosmosReference(returnTypeCore.name, container, theirId)
      : toTypename(returnTypeCore.name, theirId)
    debugHooks?.onFieldResolved?.({
      fieldType,
      source,
      sourced,
      result,
      container,
      ours,
    })
    return result
  } else {
    // No tag, we can not resolve the information by fetching...
    const container = cosmosContainerByResolveInfo(info)
    const column = ours ?? fieldType.name
    const id = Object(source)[column]
    const result = container
      ? toCosmosReference(returnTypeCore.name, container, id)
      : toTypename(returnTypeCore.name, id)
    debugHooks?.onFieldResolved?.({
      fieldType,
      source,
      result,
      ours,
    })
    return result
  }
}

export const resolveOneOursWithoutContainer = (
  ours: string | undefined,
  fieldType: GraphQL.GraphQLField<unknown, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<unknown, GraphQLCosmosContext> => async (source, _args, context, info) => {
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  if (!hasCosmosTag(source)) {
    throw Error(
      `resolveOneOursWithoutContainer: source for ${returnTypeCore.name} does not include a CosmosTag: ${pathToArray(
        info.path
      ).join(`/`)}`
    )
  }
  if (!hasId(source)) {
    throw Error(
      `resolveOneOursWithoutContainer: source for ${returnTypeCore.name} is missing column "id": ${pathToArray(
        info.path
      ).join(`/`)}`
    )
  }
  const column = ours ?? fieldType.name
  const sourced = await requireCosmosColumn(source, column, context)
  const theirId = sourced[column]
  if (theirId !== null && theirId !== undefined && typeof theirId !== `string`) {
    throw Error(
      `resolveOneOursWithoutContainer: source for ${returnTypeCore.name} not of type string: ${pathToArray(
        info.path
      ).join(`/`)}`
    )
  }
  const result = toTypename(returnTypeCore.name, theirId)
  debugHooks?.onFieldResolved?.({
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
  fieldType: GraphQL.GraphQLField<unknown, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<unknown, GraphQLCosmosContext> => async (source, _args, context, info) => {
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  if (!hasCosmosTag(source)) {
    throw Error(
      `resolveManyOursWithoutContainer: source for ${returnTypeCore.name} does not include a CosmosTag: ${pathToArray(
        info.path
      ).join(`/`)}`
    )
  }
  if (!hasId(source)) {
    throw Error(
      `resolveManyOursWithoutContainer: source for ${returnTypeCore.name} is missing column "id": ${pathToArray(
        info.path
      ).join(`/`)}`
    )
  }
  const column = ours ?? fieldType.name
  const sourced = await requireCosmosColumn(source, column, context)

  const ourList = sourced[ours ?? fieldType.name]
  if (ourList !== null && ourList !== undefined && !Array.isArray(ourList)) {
    throw Error(
      `resolveManyOursWithoutContainer: source for ${returnTypeCore.name} not of type array: ${pathToArray(
        info.path
      ).join(`/`)}`
    )
  }
  // TODO: sourced[ours] type validation
  const result = ourList?.map((id) => toTypename(returnTypeCore.name, String(id)))
  debugHooks?.onFieldResolved?.({
    fieldType,
    source,
    sourced,
    result,
    ours,
  })
  return result
}

export const resolveOneTheirs = (
  container: string,
  ours: string | undefined,
  fieldType: GraphQL.GraphQLField<unknown, GraphQLCosmosContext>
): GraphQL.GraphQLFieldResolver<unknown, GraphQLCosmosContext> => async (source, _args, context, info) => {
  const returnTypeCore = GraphQL.getNamedType(fieldType.type)
  if (!hasCosmosTag(source)) {
    throw Error(
      `resolveOneTheirs: source for ${returnTypeCore.name} does not include a CosmosTag: ${pathToArray(info.path).join(
        `/`
      )}`
    )
  }
  if (!hasId(source)) {
    throw Error(
      `resolveOneTheirs: source for ${returnTypeCore.name} is missing column "id": ${pathToArray(info.path).join(`/`)}`
    )
  }
  const column = ours ?? fieldType.name
  const sourced = await requireCosmosColumn(source, column, context)
  const theirId = sourced[ours ?? info.fieldName]
  if (theirId !== null && theirId !== undefined && typeof theirId !== `string`) {
    throw Error(
      `resolveOneTheirs: source for ${returnTypeCore.name} not of type string: ${pathToArray(info.path).join(`/`)}`
    )
  }

  const result = toCosmosReference(returnTypeCore.name, container, theirId)
  debugHooks?.onFieldResolved?.({
    fieldType,
    source,
    sourced,
    result,
    container,
    ours,
  })
  return result
}
