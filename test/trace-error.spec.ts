import gql from 'graphql-tag'
import { createUnitTestContext } from './utils'

describe(`Trace error`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos(database: "Test", container: "Dummies")
    }

    type Dummy {
      id: ID
      related: Related @cosmos(database: "Test", container: "Related", ours: "relatedId")
    }

    type Related {
      id: ID
      prop: String
    }
  `

  const responses = {
    Dummies: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }],
      'SELECT c.id, c.relatedId FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1)': [
        { id: `1`, prop: `text`, relatedId: 1 },
      ],
    },
  }

  const uc = createUnitTestContext(dummyTypeDefs, responses)

  it(`should include a stack with typenames and ids`, async () => {
    const query = `
      query {
        dummies {
          page {
            __typename
            id
            related {
              __typename
              id
              prop
            }
          }
        }
      }
    `
    const result = await uc.execute(query, false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].originalError.message.split(`\n`).slice(0, 3)).toEqual([
      `during defaultCosmosFieldResolver at Related("1").prop`,
      `| during defaultCosmosScalarFieldResolver at Related("1").prop`,
      ``,
    ])
  })
})
