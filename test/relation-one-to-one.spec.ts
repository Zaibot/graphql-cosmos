import { FeedResponse } from '@azure/cosmos'
import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema } from 'graphql-tools'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'
import { defaultDataLoader } from '../src/default'
import { schema } from '../src/graphql/directive/schema'

const dummyTypeDefs = gql`
  type Query {
    lefts: [Left] @cosmos(container: "Lefts")
  }

  type Left {
    id: ID!
    right: Right @cosmos(container: "Rights", ours: "rightId")
  }

  type Right {
    id: ID!
  }
`

const onCosmosQuery = async ({
  container,
  query,
  parameters,
}: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
  const queryResult: Record<string, Record<string, unknown[]>> = {
    Lefts: {
      'SELECT VALUE COUNT(1) FROM c': [1],
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `l` }],
      'SELECT r.id, r.rightId FROM r WHERE ARRAY_CONTAINS(@batch, r.id)': [{ id: `l`, rightId: `r` }],
    },
    Rights: {
      'SELECT c.id FROM c WHERE c.id = @id_eq ORDER BY c.id': [{ id: `r` }],
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

describe(`One to one`, () => {
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
    const query = parse(`query { lefts { total page { __typename id right { __typename id } } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        lefts: {
          total: 1,
          page: [
            {
              __typename: 'Left',
              id: `l`,
              right: { __typename: 'Right', id: `r` },
            },
          ],
        },
      },
    })
  })
})
