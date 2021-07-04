import gql from 'graphql-tag'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { createUnitTestContext } from './utils'

describe(`One to one`, () => {
  const dummyTypeDefs = gql`
    type Query {
      lefts: [Left] @cosmos
    }

    type Left @cosmos(database: "Test", container: "Lefts") {
      id: ID!
      right: Right @cosmos(ours: "rightId")
    }

    type Right @cosmos(database: "Test", container: "Rights", ours: "rightId") {
      id: ID!
    }
  `

  const responses = {
    Lefts: {
      'SELECT VALUE COUNT(1) FROM c': [1],
      'SELECT c.id, c.rightId FROM c ORDER BY c.id': [{ id: `l`, rightId: `r` }],
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
