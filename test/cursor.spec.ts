import gql from 'graphql-tag'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { createUnitTestContext } from './utils'

describe(`Pagination`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID! @where(op: "eq in")
      related: Related @cosmos(ours: "relatedId")
    }

    type Related @cosmos(database: "Test", container: "Relations") {
      id: ID!
      text: String
    }
  `

  const responses = {
    Dummies: {
      'SELECT c.id FROM c ORDER BY c.id': [{ continuationToken: `FIRST` }, { id: `1` }],
      'SELECT c.id FROM c ORDER BY c.id @FIRST': [{ id: `2` }, { id: `3` }],
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

  it(`returns part one`, async () => {
    const result = await uc.execute(`query { dummies { cursor nextCursor page { __typename id } } } `)

    expect(result).toEqual({
      data: {
        dummies: {
          cursor: null,
          nextCursor: `FIRST`,
          page: [{ __typename: 'Dummy', id: `1` }],
        },
      },
    })
  })

  it(`returns part two`, async () => {
    const result = await uc.execute(`query { dummies(cursor: "FIRST") { cursor nextCursor page { __typename id } } } `)

    expect(result).toEqual({
      data: {
        dummies: {
          cursor: `FIRST`,
          nextCursor: null,
          page: [
            { __typename: 'Dummy', id: `2` },
            { __typename: 'Dummy', id: `3` },
          ],
        },
      },
    })
  })
})
