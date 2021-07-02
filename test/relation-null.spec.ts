import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Nulled relations`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID!
      prop: String
      embedded: [Embedded]
      related: Related @cosmos(ours: "relatedId")
    }

    type Embedded {
      prop: String
      related: Related @cosmos(ours: "relatedId")
    }

    type Related @cosmos(database: "Test", container: "Related", ours: "relatedId") {
      id: ID!
      prop: String
      related: Related @cosmos(ours: "relatedId")
    }
  `

  const responses = {
    Dummies: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }, { id: `4` }, { id: `5` }],
      'SELECT c.id, c.prop, c.embedded, c.relatedId FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1,2,3,4,5)':
        [
          { id: `1`, prop: `text`, relatedId: null, embedded: [{ prop: `text`, relatedId: null }] },
          { id: `2`, prop: `text`, relatedId: undefined, embedded: [{ prop: `text`, relatedId: undefined }] },
          { id: `3`, prop: `text`, relatedId: undefined, embedded: [{ prop: `text` }] },
          { id: `4`, prop: `text`, relatedId: undefined, embedded: [{ prop: `text`, relatedId: `5` }] },
          { id: `5`, prop: `text`, embedded: [{ prop: `text` }] },
        ],
      'SELECT c.id, c.prop FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=5)': [
        { id: `1`, prop: `text`, relatedId: null, embedded: [{ prop: `text`, relatedId: null }] },
        { id: `2`, prop: `text`, relatedId: undefined, embedded: [{ prop: `text`, relatedId: undefined }] },
        { id: `3`, prop: `text`, relatedId: undefined, embedded: [{ prop: `text` }] },
        { id: `4`, prop: `text`, relatedId: undefined, embedded: [{ prop: `text`, relatedId: `5` }] },
        { id: `5`, prop: `text`, embedded: [{ prop: `text` }] },
      ],
    },
    Related: {
      'SELECT c.id, c.prop FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=5)': [{ id: `5`, prop: `text` }],
    },
  }

  const uc = createUnitTestContext(dummyTypeDefs, responses)

  it(`expects schema to remain the same`, () => {
    const output = printSchemaWithDirectives(uc.schema)
    expect(output).toMatchSnapshot()
  })

  it(`expects meta schema to remain the same`, () => {
    const output = uc.metaSchema
    expect(output).toMatchSnapshot()
  })

  it(`should be retrieve all items`, async () => {
    const query = `
      query {
        dummies {
          page {
            __typename
            id
            prop
            embedded {
              prop
              related {
                __typename
                id
                prop
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
    const result = await uc.execute(query)

    expect(result).toEqual({
      data: {
        dummies: {
          page: [
            {
              __typename: 'Dummy',
              id: `1`,
              prop: `text`,
              embedded: [{ prop: `text`, related: null }],
              related: null,
            },
            {
              __typename: 'Dummy',
              id: `2`,
              prop: `text`,
              embedded: [{ prop: `text`, related: null }],
              related: null,
            },
            {
              __typename: 'Dummy',
              id: `3`,
              prop: `text`,
              embedded: [{ prop: `text`, related: null }],
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
                    __typename: 'Related',
                    id: `5`,
                    prop: `text`,
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
                  related: null,
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
