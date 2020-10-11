import { FeedResponse } from '@azure/cosmos'
import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema } from 'graphql-tools'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'
import { defaultDataLoader } from '../src/default'
import { CosmosDirective } from '../src/graphql/directive/cosmos/directive'
import { schema } from '../src/graphql/directive/schema'
import { SqlOpScalar } from '../src/sql/op'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy] @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID!
    related: [Related] @cosmos(container: "Relations", ours: "relatedIds")
  }

  type Related {
    id: ID! @where(op: "eq")
    text: String
  }
`

const onCosmosQuery = async ({
  container,
  query,
  parameters,
}: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
  const queryResult: Record<string, Record<string, unknown[]>> = {
    Dummies: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }],
      'SELECT r.id, r.relatedIds FROM r WHERE ARRAY_CONTAINS(@batch, r.id)': [
        { id: `1`, relatedIds: [`1a`, `1b`] },
        { id: `2`, relatedIds: [`2a`, `2b`] },
        { id: `3`, relatedIds: [`3a`, `3b`] },
      ],
    },
    Relations: {
      'SELECT r.id, r.text FROM r WHERE ARRAY_CONTAINS(@batch, r.id)': [
        { id: `1b`, text: null },
        { id: `2b`, text: null },
        { id: `3b`, text: null },
      ],
    },
  }

  const result = queryResult[container]?.[query]
  if (result) {
    return { resources: result } as any
  } else {
    throw Error(
      `Unhandled: ${container} ${query} (${
        parameters.map((x) => `${x.name}=${x.value}`).toString() || `no parameters`
      })`
    )
  }
}

describe(`Data Loader`, () => {
  let context: GraphQLCosmosContext
  let dummy: GraphQLSchema
  let dataloader: SqlOpScalar[]

  beforeEach(() => {
    context = {
      directives: {
        cosmos: {
          client: null as any,
          database: null as any,
          dataloader(context) {
            if (context.container === `Relations`) {
              return (spec) => {
                dataloader.push(spec.id)
                return defaultDataLoader(onCosmosQuery)(context)(spec)
              }
            } else {
              return defaultDataLoader(onCosmosQuery)(context)
            }
          },
          onQuery: onCosmosQuery,
        },
      },
    }

    dummy = makeExecutableSchema({
      typeDefs: [schema.typeDefs, dummyTypeDefs],
      schemaDirectives: {
        ...schema.schemaDirectives,
      },
    })

    dataloader = []

    expect(validateSchema(dummy)).toHaveLength(0)
  })

  it(`should be retrieve all items`, async () => {
    const query = parse(`query { dummies { page { related { page { id text } } } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        dummies: {
          page: [
            {
              related: {
                page: [
                  { id: `1a`, text: null },
                  { id: `1b`, text: null },
                ],
              },
            },
            {
              related: {
                page: [
                  { id: `2a`, text: null },
                  { id: `2b`, text: null },
                ],
              },
            },
            {
              related: {
                page: [
                  { id: `3a`, text: null },
                  { id: `3b`, text: null },
                ],
              },
            },
          ],
        },
      },
    })
    expect(dataloader).toEqual([`1a`, `1b`, `2a`, `2b`, `3a`, `3b`])
  })
})
