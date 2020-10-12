import { FeedResponse } from '@azure/cosmos'
import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema } from 'graphql-tools'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'
import { defaultDataLoader } from '../src/default'
import { schema } from '../src/graphql/directive/schema'
import { SqlOpScalar } from '../src/sql/op'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy] @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID!
    related: Related @cosmos(container: "Relations", ours: "relatedId")
  }

  type Related {
    id: ID!
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
      'SELECT r.id, r.relatedId FROM r WHERE ARRAY_CONTAINS(@batch, r.id)': [
        { id: `1`, relatedId: `1b` },
        { id: `2`, relatedId: `2b` },
        { id: `3`, relatedId: `3b` },
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
          database: null as any,
          client: null as any,
          onQuery: onCosmosQuery,
          dataloader(spec) {
            if (spec.container === `Relations`) {
              dataloader.splice(dataloader.length, 0, ...spec.id)
              return defaultDataLoader(onCosmosQuery)(spec)
            } else {
              return defaultDataLoader(onCosmosQuery)(spec)
            }
          },
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
    const query = parse(`query { dummies { page { related { id text } } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        dummies: {
          page: [
            { related: { id: `1b`, text: null } },
            { related: { id: `2b`, text: null } },
            { related: { id: `3b`, text: null } },
          ],
        },
      },
    })
    expect(dataloader).toEqual([`1b`, `2b`, `3b`])
  })
})
