import { FeedResponse } from '@azure/cosmos'
import { execute, GraphQLSchema, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { buildCosmosASTSchema } from '../src/build'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'
import { defaultDataLoader } from '../src/default'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy] @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID!
    prop: String
    embedded: [Embedded]
    related: Related @cosmos(container: "Related", ours: "relatedId")
  }

  type Embedded {
    prop: String
    related: [Related] @cosmos(container: "Related", ours: "relatedId")
  }

  type Related {
    id: ID!
    prop: String
    related: Related @cosmos(container: "Related", ours: "relatedId")
  }
`

const onCosmosQuery = async (request: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
  const { container, query, parameters } = request
  const key = parameters.length ? `${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString()})` : query

  const responses = {
    Dummies: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }, { id: `4` }, { id: `5` }],
      'SELECT c.id, c.prop, c.embedded, c.relatedId FROM c WHERE ARRAY_CONTAINS(@batch, c.id) (@batch=1,2,3,4,5)': [
        { id: `1`, prop: `text`, relatedId: null, embedded: [{ prop: `text`, relatedId: null }] },
        { id: `2`, prop: `text`, relatedId: undefined, embedded: [{ prop: `text`, relatedId: undefined }] },
        { id: `3`, prop: `text`, relatedId: undefined, embedded: [{ prop: `text` }] },
        { id: `4`, prop: `text`, relatedId: undefined, embedded: [{ prop: `text`, relatedId: [`5`] }] },
        { id: `5`, prop: `text`, embedded: [{ prop: `text` }] },
      ],
    },
    Related: {
      'SELECT c.id, c.prop FROM c WHERE ARRAY_CONTAINS(@batch, c.id) (@batch=5)': [
        { id: `5`, prop: `text`, relatedId: `5` },
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
describe(`Nulled relations`, () => {
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
    const query = gql`
      query {
        dummies {
          page {
            __typename
            id
            prop
            embedded {
              prop
              related {
                page {
                  __typename
                  id
                  prop
                }
              }
            }
            related {
              __typename
              id
              prop
              related {
                __typename
                id
                prop
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
          page: [
            {
              __typename: 'Dummy',
              id: `1`,
              prop: `text`,
              embedded: [{ prop: `text`, related: { page: [] } }],
              related: null,
            },
            {
              __typename: 'Dummy',
              id: `2`,
              prop: `text`,
              embedded: [{ prop: `text`, related: { page: [] } }],
              related: null,
            },
            {
              __typename: 'Dummy',
              id: `3`,
              prop: `text`,
              embedded: [{ prop: `text`, related: { page: [] } }],
              related: null,
            },
            {
              __typename: 'Dummy',
              id: `4`,
              prop: `text`,
              embedded: [
                {
                  prop: `text`,
                  related: {
                    page: [
                      {
                        __typename: 'Related',
                        id: `5`,
                        prop: `text`,
                      },
                    ],
                  },
                },
              ],
              related: null,
            },
            {
              __typename: 'Dummy',
              id: `5`,
              prop: `text`,
              embedded: [
                {
                  prop: `text`,
                  related: { page: [] },
                },
              ],
              related: null,
            },
          ],
        },
      },
    })
  })
})
