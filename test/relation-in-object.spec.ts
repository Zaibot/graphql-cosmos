import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Embedded relations`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID!
      embedded: [Embedded]
    }

    type Embedded {
      id: ID!
    }
  `

  const responses = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [3],
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }],
      'SELECT c.id, c.embedded FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1,2,3)': [
        { id: `1`, embedded: [{ id: `1b` }] },
        { id: `2`, embedded: [{ id: `2b` }] },
        { id: `3`, embedded: [{ id: `3b` }] },
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
    const result = await uc.execute(`query { dummies { total page { __typename id embedded { __typename id } } } }`)

    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            {
              __typename: 'Dummy',
              id: `1`,
              embedded: [{ __typename: 'Embedded', id: `1b` }],
            },
            {
              __typename: 'Dummy',
              id: `2`,
              embedded: [{ __typename: 'Embedded', id: `2b` }],
            },
            {
              __typename: 'Dummy',
              id: `3`,
              embedded: [{ __typename: 'Embedded', id: `3b` }],
            },
          ],
        },
      },
    })
  })
})
