import gql from 'graphql-tag'
import { createUnitTestContext } from './utils'

describe(`Trace error`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID
      related: Related @cosmos(ours: "relatedId")
    }

    type Related @cosmos(database: "Test", container: "Related") {
      id: ID
      prop: String
    }
  `

  const responses = {
    Dummies: {
      'SELECT c.id, c.relatedId FROM c ORDER BY c.id': [{ id: `1` }],
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
    expect(result.errors[0].originalError.message).toContain(`during one-ours at Dummy("1").related`)
  })
})
