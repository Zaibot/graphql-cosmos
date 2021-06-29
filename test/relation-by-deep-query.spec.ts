import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Reference to deep container`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy!]! @cosmos(database: "Test", container: "Dummies")
    }

    type Dummy {
      id: ID! @where(op: "eq")
      related: [Related!]! @cosmos(database: "Test", container: "Relations", ours: "relatedIds", pagination: "on")
    }

    type Related {
      id: ID! @where(op: "eq")
    }
  `

  const responses = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [1],
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }],
      'SELECT c.id, c.relatedIds FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1)': [
        { id: `1`, relatedIds: [`1b`, `2b`] },
      ],
    },
    Relations: {
      'SELECT VALUE COUNT(1) FROM c WHERE c.id = @p2 AND ARRAY_CONTAINS(@p4, c.id) (@p2=1b,@p4=1b,2b)': [1],
      'SELECT c.id FROM c WHERE c.id = @p2 AND ARRAY_CONTAINS(@p4, c.id) ORDER BY c.id (@p2=1b,@p4=1b,2b)': [
        { id: `1b` },
      ],
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
    const result = await uc.execute(query)

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
