import { GraphQLCosmosPageInput, GraphQLCosmosPageOutput } from '../4-resolver-builder/3-schema-transformer'
import { fail, lazy } from '../typescript'
import { parseInputSort, parseInputWhere } from './input-args'
import { GraphQLCosmosFieldResolver } from './resolver'
import { SourceDescriptor } from './x-descriptors'

export const defaultCosmosRootFieldResolver: GraphQLCosmosFieldResolver = async (
  parent,
  args,
  context,
  info
): Promise<GraphQLCosmosPageOutput | Array<SourceDescriptor.Embedded<{ id: string }>>> => {
  const field = context.dataSources.graphqlCosmos.meta.requireField(info.parentType.name, info.fieldName)
  const type = context.dataSources.graphqlCosmos.meta.requireType(field.returnTypename)
  if (field.pagination) {
    const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
    const cursor = pageArgs.cursor ?? null
    const limit = pageArgs.limit ?? 50
    const where = parseInputWhere(pageArgs.where ?? {})
    const sort = parseInputSort(pageArgs.sort ?? {})

    const database = field.database ?? type.database ?? fail(`requires database`)
    const container = field.container ?? type.container ?? fail(`requires container`)

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
        typename: type.typename,
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
        typename: type.typename,
        limit: null,
      })
      const result = await context.dataSources.graphqlCosmos.query(query)
      return result
    })

    return {
      get page() {
        return query().then((feed) =>
          feed.resources.map((item) =>
            context.dataSources.graphqlCosmos.single(type.typename, database, container, item)
          )
        )
      },
      get cursor() {
        return Promise.resolve(cursor)
      },
      get nextCursor() {
        return query().then((x) => x.continuationToken)
      },
      get total() {
        return count().then((x) => Number(x.resources[0]))
      },
    }
  } else {
    const pageArgs = (args ?? {}) as Partial<GraphQLCosmosPageInput>
    const where = parseInputWhere(pageArgs.where ?? {})
    const sort = parseInputSort(pageArgs.sort ?? {})

    const database = field.database ?? type.database ?? fail(`requires database`)
    const container = field.container ?? type.container ?? fail(`requires container`)

    const query = context.dataSources.graphqlCosmos.buildQuery({
      database,
      container,
      context,
      cursor: null,
      fields: [`id`],
      origin: SourceDescriptor.hasDescriptor(parent) ? parent : null,
      sort,
      where,
      typename: type.typename,
      limit: null,
    })
    const feed = await context.dataSources.graphqlCosmos.query<{ id: string }>(query)
    return feed.resources.map((item) =>
      SourceDescriptor.withDescriptor(item, {
        kind: `Single`,
        database,
        container,
        typename: type.typename,
        id: item.id,
      })
    )
  }
}
