import { assert } from 'console'
import { GraphQLResolveInfo } from 'graphql'
import { GraphQLCosmosContext, GraphQLCosmosInitRequest, GraphQLCosmosRequest } from '../../configuration'
import { DEFAULT } from '../../constants'
import { defaultOnInit, defaultOnQuery } from '../../default'
import { getId, getTypename } from '../../object-type-id'
import { CosmosArgSort, CosmosArgWhere, CosmosRequest } from '../../intermediate/model'
import { isSqlOperation, SqlOperationList, SqlOperationScalar, SqlOpScalar } from '../../sql/op'
import { toCosmosReference } from '../reference'

const parseWhere = (where: Record<string, unknown>): Array<CosmosArgWhere> => {
  return Object.entries(where).map(([whereField, value]) => {
    const [property, operation = ``] = whereField.split(`_`)
    if (isSqlOperation(operation)) {
      return {
        property,
        operation,
        value: value as SqlOpScalar,
        parameter: `@${whereField}`,
      }
    } else {
      throw Error(`unknown operation type on field ${whereField}`)
    }
  })
}

const parseSort = (sort: Record<string, number>): Array<CosmosArgSort> => {
  return Object.entries(sort)
    .sort((a, b) => a[1] - b[1])
    .map(([sortField, _value]) => {
      const [property, direction] = sortField.split(`_`)
      return { property, direction }
    })
}

export const argsToCosmosCountRequest = (
  resolverDescription: string,
  args: Record<string, SqlOpScalar>,
  graphqlInfo: GraphQLResolveInfo
) => {
  const { where = {} } = args

  const graphquery: CosmosRequest = {
    resolverDescription,
    graphqlInfo,
    type: `count`,
    columns: [],
    where: parseWhere(where),
    sort: [],
    cursor: undefined,
  }

  return graphquery
}

export const argsToCosmosRequest = (
  resolverDescription: string,
  columnNames: string[],
  args: Record<string, SqlOpScalar>,
  graphqlInfo: GraphQLResolveInfo
) => {
  const { where = {}, sort = {}, cursor = undefined as string | undefined } = args

  const graphquery: CosmosRequest = {
    resolverDescription,
    graphqlInfo,
    type: `query`,
    columns: columnNames,
    where: parseWhere(where),
    sort: parseSort(sort),
    cursor: cursor?.toString(),
  }

  return graphquery
}

export const cosmosResolve = async (
  typename: string,
  graphquery: CosmosRequest,
  context: GraphQLCosmosContext,
  container: string
) => {
  const { cosmos } = context.directives
  const { onBeforeQuery, onQuery = defaultOnQuery, onInit = defaultOnInit, dataloader } = cosmos

  const hasDataloader = Boolean(dataloader)

  //
  // Prepare CosmosDB query
  const init: GraphQLCosmosInitRequest = {
    request: graphquery,
    client: cosmos.client,
    database: cosmos.database,
    container,
    options: {
      continuationToken: graphquery.cursor,
    },
  }
  onInit(graphquery, init)

  if (graphquery.type === `count`) {
    //
    // Notify query about to be requested
    onBeforeQuery?.(init)

    if (!init.query) {
      throw Error(`requires query`)
    }
    if (!init.parameters) {
      throw Error(`requires query parameters`)
    }

    //
    // Send CosmosDB query
    const request: GraphQLCosmosRequest = {
      init,
      client: init.client,
      database: init.database,
      container: init.container,
      query: init.query.toSql(),
      parameters: init.parameters,
      options: init.options,
    }

    const response = await onQuery(request)

    assert(Array.isArray(response.resources), `count query expects response of list with a single number`)
    assert(response.resources.length === 1, `count query expects response of list with a single number`)
    assert(typeof response.resources[0] === `number`, `count query expects response of list with a single number`)

    return response.resources[0]
  } else {
    //
    // When looking for a single `id` value, attempt to use data loader
    const byId = graphquery.where.find((x) => x.property === DEFAULT.ID)

    const singleExpression = graphquery.where.length === 1
    if (hasDataloader && singleExpression && byId?.operation === SqlOperationScalar.eq && !Array.isArray(byId.value)) {
      // Defer to using dataloader
      const page = [byId.value].map((x) => toCosmosReference(getTypename(x) ?? typename, container, getId(x)))
      return { page }
    } else if (
      hasDataloader &&
      singleExpression &&
      byId?.operation === SqlOperationList.in &&
      Array.isArray(byId.value)
    ) {
      // Defer to using dataloader
      const page = byId.value.map((x) => toCosmosReference(getTypename(x) ?? typename, container, getId(x)))
      return { page }
    } else {
      //
      // Notify query about to be requested
      onBeforeQuery?.(init)

      if (!init.query) {
        throw Error(`requires query`)
      }
      if (!init.parameters) {
        throw Error(`requires query parameters`)
      }

      //
      // Send CosmosDB query
      const request: GraphQLCosmosRequest = {
        init,
        client: init.client,
        database: init.database,
        container: init.container,
        query: init.query.toSql(),
        parameters: init.parameters,
        options: init.options,
      }

      const response = await onQuery(request)
      const nextCursor = response.continuationToken
      const page = response.resources.map((x) => toCosmosReference(getTypename(x) ?? typename, container, getId(x)))
      return { response, nextCursor, page }
    }
  }
}

export const cosmosResolveCount = async (
  graphquery: CosmosRequest,
  context: GraphQLCosmosContext,
  container: string
) => {
  const { cosmos } = context.directives
  const { onBeforeQuery, onQuery = defaultOnQuery, onInit = defaultOnInit } = cosmos

  //
  // Prepare CosmosDB query
  const init: GraphQLCosmosInitRequest = {
    request: graphquery,
    client: cosmos.client,
    database: cosmos.database,
    container,
    options: {
      continuationToken: graphquery.cursor,
    },
  }
  onInit(graphquery, init)

  //
  // Notify query about to be requested
  onBeforeQuery?.(init)

  if (!init.query) {
    throw Error(`requires query`)
  }
  if (!init.parameters) {
    throw Error(`requires query parameters`)
  }

  //
  // Send CosmosDB query
  const request: GraphQLCosmosRequest = {
    init,
    client: init.client,
    database: init.database,
    container: init.container,
    query: init.query.toSql(),
    parameters: init.parameters,
    options: init.options,
  }

  const response = await onQuery(request)

  assert(Array.isArray(response.resources), `count query expects response of list with a single number`)
  assert(response.resources.length === 1, `count query expects response of list with a single number`)
  assert(typeof response.resources[0] === `number`, `count query expects response of list with a single number`)

  return response.resources[0]
}
