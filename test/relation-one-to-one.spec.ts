import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`One to one`, () => {
  const dummyTypeDefs = gql`
    type Query {
      lefts: [Left] @cosmos(database: "Test", container: "Lefts")
    }

    type Left {
      id: ID!
      right: Right @cosmos(database: "Test", container: "Rights", ours: "rightId")
    }

    type Right {
      id: ID!
    }
  `

  const responses = {
    Lefts: {
      'SELECT VALUE COUNT(1) FROM c': [1],
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `l` }],
      'SELECT c.id, c.rightId FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=l)': [
        { id: `l`, rightId: `r` },
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
    const result = await uc.execute(`query { lefts { total page { __typename id right { __typename id } } } }`)

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
