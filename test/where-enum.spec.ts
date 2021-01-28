import { FeedResponse } from '@azure/cosmos'
import { execute, GraphQLSchema, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema } from 'graphql-tools'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'
import { defaultDataLoader } from '../src/default'
import { GraphQLCosmosSchema } from '../src/graphql/directive/schema'

const dummyTypeDefs = gql`
  type Query {
    entities: [Entity!]! @cosmos(container: "Entities")
  }

  type Entity {
    id: ID!
    status: Status! @where(op: "eq neq")
  }

  enum Status {
    OPEN
    CLOSE
  }
`

const onCosmosQuery = async (request: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
  const { container, query, parameters } = request
  const key = parameters.length ? `${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString()})` : query

  const responses: Record<string, Record<string, unknown[]>> = {
    Entities: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }],
      'SELECT c.id, c.status FROM c WHERE ARRAY_CONTAINS(@batch, c.id) (@batch=1,2)': [
        { __typename: 'Entity', id: `1`, status: `OPEN` },
        { __typename: 'Entity', id: `2`, status: `CLOSE` },
      ],
      'SELECT c.id, c.status FROM c WHERE ARRAY_CONTAINS(@batch, c.id) (@batch=1)': [
        { __typename: 'Entity', id: `1`, status: `OPEN` },
      ],
      'SELECT c.id, c.status FROM c WHERE ARRAY_CONTAINS(@batch, c.id) (@batch=2)': [
        { __typename: 'Entity', id: `2`, status: `CLOSE` },
      ],
      'SELECT c.id FROM c WHERE c.status = @status_eq ORDER BY c.id (@status_eq=OPEN)': [{ id: `1` }],
      'SELECT c.id FROM c WHERE c.status != @status_neq ORDER BY c.id (@status_neq=OPEN)': [{ id: `2` }],
    },
  }

  const result = responses[container]?.[key]
  if (result) {
    return { resources: result } as any
  } else {
    throw Error(`Unhandled: ${container} ${key}`)
  }
}

describe(`Where`, () => {
  let context: GraphQLCosmosContext
  let dummy: GraphQLSchema

  beforeEach(() => {
    const loader = defaultDataLoader()

    context = {
      directives: {
        cosmos: {
          database: null as any,
          client: null as any,
          onQuery: onCosmosQuery,
          dataloader: loader,
        },
      },
    }

    dummy = makeExecutableSchema({
      typeDefs: [GraphQLCosmosSchema.typeDefs, dummyTypeDefs],
      schemaDirectives: {
        ...GraphQLCosmosSchema.schemaDirectives,
      },
    })

    expect(validateSchema(dummy)).toHaveLength(0)
  })

  it(`should retrieve all`, async () => {
    const query = gql`
      query {
        entities {
          page {
            __typename
            id
            status
          }
        }
      }
    `
    expect(validate(dummy, query)).toHaveLength(0)

    const result = await execute(dummy, query, undefined, context)
    result.errors?.forEach((e) => console.error(e.path.join(`/`), e.stack))

    expect(result).toEqual({
      data: {
        entities: {
          page: [
            {
              __typename: 'Entity',
              id: `1`,
              status: `OPEN`,
            },
            {
              __typename: 'Entity',
              id: `2`,
              status: `CLOSE`,
            },
          ],
        },
      },
    })
  })

  it(`should retrieve all open`, async () => {
    const query = gql`
      query {
        entities(where: { status_eq: OPEN }) {
          page {
            __typename
            id
            status
          }
        }
      }
    `
    expect(validate(dummy, query)).toHaveLength(0)

    const result = await execute(dummy, query, undefined, context)
    result.errors?.forEach((e) => console.error(e.path.join(`/`), e.stack))

    expect(result).toEqual({ data: { entities: { page: [{ __typename: 'Entity', id: `1`, status: `OPEN` }] } } })
  })

  it(`should retrieve all close`, async () => {
    const query = gql`
      query {
        entities(where: { status_neq: OPEN }) {
          page {
            __typename
            id
            status
          }
        }
      }
    `
    expect(validate(dummy, query)).toHaveLength(0)

    const result = await execute(dummy, query, undefined, context)
    result.errors?.forEach((e) => console.error(e.path.join(`/`), e.stack))

    expect(result).toEqual({ data: { entities: { page: [{ __typename: 'Entity', id: `2`, status: `CLOSE` }] } } })
  })
})
