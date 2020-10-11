import { FeedResponse } from '@azure/cosmos'
import { execute, GraphQLSchema, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema } from 'graphql-tools'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'
import { defaultDataLoader } from '../src/default'
import { schema } from '../src/graphql/directive/schema'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy!]! @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID! @where(op: "eq")
    related: [Related!]! @cosmos(container: "Relations", ours: "relatedIds")
  }

  type Related {
    id: ID! @where(op: "eq")
  }
`

const onCosmosQuery = async (request: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
  const { container, query, parameters } = request
  const key = parameters.length ? `${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString()})` : query

  const responses: Record<string, Record<string, unknown[]>> = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [1],
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }],
      'SELECT r.id, r.relatedIds FROM r WHERE ARRAY_CONTAINS(@batch, r.id) (@batch=1)': [
        { id: `1`, relatedIds: [`1b`, `2b`] },
      ],
    },
    Relations: {
      'SELECT VALUE COUNT(1) FROM c WHERE c.id = @id_eq AND ARRAY_CONTAINS(@id_in, c.id) (@id_eq=1b,@id_in=1b,2b)': [1],
      'SELECT c.id FROM c WHERE c.id = @id_eq AND ARRAY_CONTAINS(@id_in, c.id) ORDER BY c.id (@id_eq=1b,@id_in=1b,2b)': [
        { id: `1b` },
      ],
    },
  }

  const result = responses[container]?.[key]
  if (result) {
    return { resources: result } as any
  } else {
    throw Error(`Unhandled: ${container} ${key}`)
  }
}

describe(`Reference to deep container`, () => {
  let context: GraphQLCosmosContext
  let dummy: GraphQLSchema

  beforeEach(() => {
    context = {
      directives: {
        cosmos: {
          database: null as any,
          client: null as any,
          onQuery: onCosmosQuery,
          dataloader: defaultDataLoader(onCosmosQuery),
        },
      },
    }

    dummy = makeExecutableSchema({
      typeDefs: [schema.typeDefs, dummyTypeDefs],
      schemaDirectives: {
        ...schema.schemaDirectives,
      },
    })

    expect(validateSchema(dummy)).toHaveLength(0)
  })

  it(`should be retrieve all items`, async () => {
    const query = gql`
      query {
        dummies {
          total
          page {
            __typename
            id
            related(where: { id_eq: "1b" }) {
              total
              page {
                __typename
                id
              }
            }
          }
        }
      }
    `
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        dummies: {
          total: 1,
          page: [
            {
              __typename: 'Dummy',
              id: `1`,
              related: {
                total: 1,
                page: [{ __typename: 'Related', id: `1b` }],
              },
            },
          ],
        },
      },
    })
  })
})
