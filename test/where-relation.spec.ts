import { FeedResponse } from '@azure/cosmos'
import { execute, GraphQLSchema, printSchema, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { buildCosmosASTSchema } from '../src/build'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'
import { defaultDataLoader } from '../src/default'

const dummyTypeDefs = gql`
  type Query {
    entities: [Entity!]! @cosmos(container: "Entities")
  }

  type Entity {
    id: ID!
    related: Related @cosmos(container: "Related", ours: "relatedId") @where(op: "eq", ours: "relatedId")
  }

  type Related {
    id: ID!
    text: String
  }
`

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

    dummy = buildCosmosASTSchema(dummyTypeDefs)
  })

  it(`schema`, async () => {
    const output = printSchema(dummy, { commentDescriptions: false })
    expect(validateSchema(dummy)).toHaveLength(0)
    expect(output).toMatchSnapshot()
  })

  it(`should retrieve all`, async () => {
    const query = gql`
      query {
        entities {
          page {
            __typename
            id
            related {
              __typename
              id
              text
            }
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
              related: {
                __typename: 'Related',
                id: `1a`,
                text: `a`,
              },
            },
            {
              __typename: 'Entity',
              id: `2`,
              related: {
                __typename: 'Related',
                id: `2b`,
                text: `b`,
              },
            },
          ],
        },
      },
    })
  })

  it(`should retrieve 1a`, async () => {
    const query = gql`
      query {
        entities(where: { relatedId_eq: "1a" }) {
          page {
            __typename
            id
            related {
              __typename
              id
              text
            }
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
              related: {
                __typename: 'Related',
                id: `1a`,
                text: `a`,
              },
            },
          ],
        },
      },
    })
  })
})

async function onCosmosQuery(request: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> {
  const { container, query, parameters } = request
  const key = parameters.length ? `${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString()})` : query

  const responses: Record<string, Record<string, unknown[]>> = {
    Entities: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }],
      'SELECT c.id, c.relatedId FROM c WHERE ARRAY_CONTAINS(@batch, c.id) (@batch=1,2)': [
        { __typename: 'Entity', id: `1`, relatedId: `1a` },
        { __typename: 'Entity', id: `2`, relatedId: `2b` },
      ],
      'SELECT c.id FROM c WHERE c.relatedId = @relatedId_eq ORDER BY c.id (@relatedId_eq=1a)': [
        { __typename: 'Entity', id: `1` },
      ],
      'SELECT c.id, c.relatedId FROM c WHERE ARRAY_CONTAINS(@batch, c.id) (@batch=1)': [
        { __typename: 'Entity', id: `1`, relatedId: `1a` },
      ],
    },
    Related: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1a` }, { id: `2b` }],
      'SELECT c.id, c.text FROM c WHERE ARRAY_CONTAINS(@batch, c.id) (@batch=1a,2b)': [
        { __typename: 'Related', id: `1a`, text: `a` },
        { __typename: 'Related', id: `2b`, text: `b` },
      ],
      'SELECT c.id, c.text FROM c WHERE ARRAY_CONTAINS(@batch, c.id) (@batch=1a)': [
        { __typename: 'Related', id: `1a`, text: `a` },
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
