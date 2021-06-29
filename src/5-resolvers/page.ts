import { FeedResponse } from '@azure/cosmos'
import { defaultFieldResolver } from 'graphql'
import { pathToArray } from 'graphql/jsutils/Path'
import { GraphQLCosmosPageInput, GraphQLCosmosPageOutput } from '../4-resolver-builder/3-schema-transformer'
import { failql, Lazy, lazy } from '../typescript'
import { parseInputSort, parseInputWhere } from './input-args'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosPageFieldResolver: GraphQLCosmosFieldResolver = async (parent, args, context, info) => {
  const parentType = context.dataSources.graphqlCosmos.meta.requireType(info.parentType.name)
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const returnType = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)
  const source = SourceDescriptor.getDescriptor(parent)

  if (field.ours) {
    const current =
      source?.kind === `Single`
        ? await context.dataSources.graphqlCosmos.load(source, field.ours)
        : Object(parent)[field.ours ?? field.fieldname] ?? []
    if (field.pagination) {
      if (current?.length === 0) {
        return emptypage
      }

      const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
      const cursor = pageArgs.cursor ?? null
      const limit = pageArgs.limit ?? 50
      const where = parseInputWhere({ and: [pageArgs.where ?? {}, { [`${field.theirs ?? `id`}_in`]: current }] })
      const sort = parseInputSort(pageArgs.sort ?? {})

      const database = field.database ?? parentType.database ?? failql(`requires database`, info)
      const container = field.container ?? parentType.container ?? failql(`requires container`, info)

      const query = lazy(async () => {
        const query = context.dataSources.graphqlCosmos.buildQuery({
          database,
          container,
          context,
          cursor,
          fields: [`id`],
          origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
          sort,
          where,
          typename: returnType.typename,
          limit,
        })
        const result = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
        return result
      })

      const count = lazy(async () => {
        const query = context.dataSources.graphqlCosmos.buildCountQuery({
          database,
          container,
          context,
          cursor: null,
          fields: [],
          origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
          sort: [],
          where,
          typename: returnType.typename,
          limit: null,
        })
        const result = await context.dataSources.graphqlCosmos.query<number>(query)
        return result
      })

      return graphqlCosmosPageResponse(returnType.typename, database, container, cursor, query, count)
    } else {
      if (current?.length === 0) {
        return []
      }

      const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
      const where = parseInputWhere({ and: [pageArgs.where ?? {}, { [`${field.theirs ?? `id`}_in`]: current }] })
      const sort = parseInputSort(pageArgs.sort ?? {})

      const database = field.database ?? parentType.database ?? failql(`requires database`, info)
      const container = field.container ?? parentType.container ?? failql(`requires container`, info)

      const query = context.dataSources.graphqlCosmos.buildQuery({
        database,
        container,
        context,
        cursor: null,
        fields: [`id`],
        origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
        sort,
        where,
        typename: returnType.typename,
        limit: null,
      })
      const feed = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
      return feed.resources.map(wrapSingleSourceDescriptor(returnType.typename, database, container))
    }
  }

  if (field.ours) {
    const current = defaultFieldResolver(parent, args, context, info)
    if (field.pagination) {
      const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
      const cursor = pageArgs.cursor ?? null
      const limit = pageArgs.limit ?? 50
      const where = parseInputWhere({ and: [pageArgs.where ?? {}, { [`${field.theirs ?? `id`}_in`]: current }] })
      const sort = parseInputSort(pageArgs.sort ?? {})

      const database = field.database ?? parentType.database ?? failql(`requires database`, info)
      const container = field.container ?? parentType.container ?? failql(`requires container`, info)

      const query = lazy(async () => {
        const query = context.dataSources.graphqlCosmos.buildQuery({
          database,
          container,
          context,
          cursor,
          fields: [`id`],
          origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
          sort,
          where,
          typename: returnType.typename,
          limit,
        })
        const result = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
        return result
      })

      const count = lazy(async () => {
        const query = context.dataSources.graphqlCosmos.buildCountQuery({
          database,
          container,
          context,
          cursor: null,
          fields: [],
          origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
          sort: [],
          where,
          typename: returnType.typename,
          limit: null,
        })
        const result = await context.dataSources.graphqlCosmos.query<number>(query)
        return result
      })

      return graphqlCosmosPageResponse(returnType.typename, database, container, cursor, query, count)
    } else {
      const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
      const where = parseInputWhere({ and: [pageArgs.where ?? {}, { [`${field.theirs ?? `id`}_in`]: current }] })
      const sort = parseInputSort(pageArgs.sort ?? {})

      const database = field.database ?? parentType.database ?? failql(`requires database`, info)
      const container = field.container ?? parentType.container ?? failql(`requires container`, info)

      const query = context.dataSources.graphqlCosmos.buildQuery({
        database,
        container,
        context,
        cursor: null,
        fields: [`id`],
        origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
        sort,
        where,
        typename: returnType.typename,
        limit: null,
      })
      const feed = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
      return feed.resources.map(wrapSingleSourceDescriptor(returnType.typename, database, container))
    }
  }

  if (field.theirs && source?.kind === `Single`) {
    if (field.pagination) {
      const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
      const cursor = pageArgs.cursor ?? null
      const limit = pageArgs.limit ?? 50
      const where = parseInputWhere({ and: [pageArgs.where ?? {}, { [`${field.theirs}_in`]: source.id }] })
      const sort = parseInputSort(pageArgs.sort ?? {})

      const database = field.database ?? returnType.database ?? failql(`requires database`, info)
      const container = field.container ?? returnType.container ?? failql(`requires container`, info)

      const query = lazy(async () => {
        const query = context.dataSources.graphqlCosmos.buildQuery({
          database,
          container,
          context,
          cursor,
          fields: [`id`],
          origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
          sort,
          where,
          typename: returnType.typename,
          limit,
        })
        const result = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
        return result
      })

      const count = lazy(async () => {
        const query = context.dataSources.graphqlCosmos.buildCountQuery({
          database,
          container,
          context,
          cursor: null,
          fields: [],
          origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
          sort: [],
          where,
          typename: returnType.typename,
          limit: null,
        })
        const result = await context.dataSources.graphqlCosmos.query<number>(query)
        return result
      })

      return graphqlCosmosPageResponse(returnType.typename, database, container, cursor, query, count)
    } else {
      const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
      const where = parseInputWhere(pageArgs.where ?? {})
      const sort = parseInputSort(pageArgs.sort ?? {})

      const database = field.database ?? parentType.database ?? failql(`requires database`, info)
      const container = field.container ?? parentType.container ?? failql(`requires container`, info)

      const query = context.dataSources.graphqlCosmos.buildQuery({
        database,
        container,
        context,
        cursor: null,
        fields: [`id`],
        origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
        sort,
        where,
        typename: returnType.typename,
        limit: null,
      })
      const feed = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
      return feed.resources.map(wrapSingleSourceDescriptor(returnType.typename, database, container))
    }
  }

  if (source?.kind === `Single`) {
    return await context.dataSources.graphqlCosmos.load(source, field.ours ?? field.fieldname)
  }

  console.error(`fallthrough on ${pathToArray(info.path).join(`/`)}`)
  return defaultFieldResolver(parent, args, context, info)
}

const emptypage: GraphQLCosmosPageOutput = {
  page: [],
  cursor: null,
  nextCursor: null,
  total: 0,
}

function graphqlCosmosPageResponse(
  typename: string,
  database: string,
  container: string,
  cursor: string | null,
  query: Lazy<Promise<FeedResponse<{ id: string }>>>,
  count: Lazy<Promise<FeedResponse<number>>>
): GraphQLCosmosPageOutput {
  return {
    get page() {
      return query().then((feed) => feed.resources.map(wrapSingleSourceDescriptor(typename, database, container)))
    },
    get cursor() {
      return Promise.resolve(cursor)
    },
    get nextCursor() {
      return query().then((x) => x.continuationToken)
    },
    get total() {
      return count().then((x) => x.resources[0])
    },
  }
}

function wrapSingleSourceDescriptor(typename: string, database: string, container: string) {
  // TODO, use refSingle of datasource
  return (item: { id: string }) =>
    SourceDescriptor.withDescriptor(item, {
      kind: `Single`,
      database,
      container,
      typename,
      id: item.id,
    })
}
