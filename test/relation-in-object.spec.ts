import { FeedResponse } from '@azure/cosmos'
import { buildASTSchema, execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'
import { defaultDataLoader } from '../src/default'
import { GraphQLCosmosSchema } from '../src/graphql/directive/schema'
import { buildCosmosASTSchema } from '../src/build'
import { reportHooks } from './utils'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy] @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID!
    embedded: [Embedded]
  }

  type Embedded {
    id: ID!
  }
`

const onCosmosQuery = async ({
  container,
  query,
  parameters,
}: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
  const queryResult: Record<string, Record<string, unknown[]>> = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [3],
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }],
      'SELECT c.id, c.embedded FROM c WHERE ARRAY_CONTAINS(@batch, c.id)': [
        { id: `1`, embedded: [{ id: `1b` }] },
        { id: `2`, embedded: [{ id: `2b` }] },
        { id: `3`, embedded: [{ id: `3b` }] },
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

describe(`Embedded relations`, () => {
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

    dummy = buildCosmosASTSchema(dummyTypeDefs)

    expect(validateSchema(dummy)).toHaveLength(0)
  })

  it(`should be retrieve all items`, async () => {
    const query = parse(`query { dummies { total page { __typename id embedded { __typename id } } } }`)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            {
              __typename: 'Dummy',
              id: `1`,
              embedded: [{ __typename: 'Embedded', id: `1b` }],
            },
            {
              __typename: 'Dummy',
              id: `2`,
              embedded: [{ __typename: 'Embedded', id: `2b` }],
            },
            {
              __typename: 'Dummy',
              id: `3`,
              embedded: [{ __typename: 'Embedded', id: `3b` }],
            },
          ],
        },
      },
    })
  })
})
