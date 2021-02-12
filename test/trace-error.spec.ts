import { FeedResponse } from '@azure/cosmos'
import { execute, GraphQLSchema, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { buildCosmosASTSchema } from '../src/build'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'
import { defaultDataLoader } from '../src/default'
import { traceErrorMiddleware } from '../src/error'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy] @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID
    related: Related @cosmos(container: "Related", ours: "relatedId")
  }

  type Related {
    id: ID
  }
`

const onCosmosQuery = async (request: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
  const { container, query, parameters } = request
  const key = parameters.length ? `${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString()})` : query

  const responses = {
    Dummies: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }],
      'SELECT c.id, c.relatedId FROM c WHERE ARRAY_CONTAINS(@batch, c.id) (@batch=1)': [
        { id: `1`, prop: `text`, relatedId: 1 },
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
describe(`Trace error`, () => {
  let context: GraphQLCosmosContext
  let dummy: GraphQLSchema

  beforeEach(() => {
    const loader = defaultDataLoader()

    context = {
      directives: {
        error: traceErrorMiddleware,
        cosmos: {
          database: null as any,
          client: null as any,
          onQuery: onCosmosQuery,
          dataloader: loader,
        },
      },
    }

    dummy = buildCosmosASTSchema(dummyTypeDefs)

    expect(validateSchema(dummy)).toHaveLength(0)
  })

  it(`should include a stack with typenames and ids`, async () => {
    const query = gql`
      query {
        dummies {
          page {
            __typename
            id
            related {
              __typename
              id
            }
          }
        }
      }
    `
    const result = await execute(dummy, query, undefined, context)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].originalError.message.split(`\n`).slice(0, 3)).toEqual([
      `during resolveOneOurs at Dummy("1").related`,
      `| during DefaultCosmosFieldResolver at Dummy("1").related`,
      ``,
    ])
  })
})
