import gql from 'graphql-tag'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { createUnitTestContext } from './utils'

describe(`Reference to other container (root)`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID!
      related: [Related] @cosmos(ours: "relatedIds", pagination: "on")
    }

    type Related @cosmos(database: "Test", container: "Relations") {
      id: ID!
      dummies: [Dummy] @cosmos(theirs: "relatedIds")
    }
  `

  const responses = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [3],
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }],
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

  it(`should be retrieve all items (root)`, async () => {
    const result = await uc.execute(`query { dummies { total page { __typename id } } } `)
    if (result.errors?.length) {
      result.errors.forEach((e) => console.error(e.path.join(`/`), e.stack))
    }

    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            { __typename: 'Dummy', id: `1` },
            { __typename: 'Dummy', id: `2` },
            { __typename: 'Dummy', id: `3` },
          ],
        },
      },
    })
  })
})
