import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Sorting`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID! @sort
      name: String! @sort
    }
  `

  const responses = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [3],
      'SELECT c.id, c.name FROM c ORDER BY c.name, c.id': [
        { id: `1`, name: `A` },
        { id: `2`, name: `B` },
        { id: `3`, name: `C` },
      ],
      'SELECT c.id, c.name FROM c ORDER BY c.name DESC, c.id DESC, c.id': [
        { id: `3`, name: `C` },
        { id: `2`, name: `B` },
        { id: `1`, name: `A` },
      ],
      'SELECT c.id, c.name FROM c ORDER BY c.name DESC, c.id': [
        { id: `3`, name: `C` },
        { id: `2`, name: `B` },
        { id: `1`, name: `A` },
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
    const result = await uc.execute(`query { dummies(sort: { name_ASC: 1 }) { total page { __typename id name } } } `)

    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            { __typename: 'Dummy', id: `1`, name: `A` },
            { __typename: 'Dummy', id: `2`, name: `B` },
            { __typename: 'Dummy', id: `3`, name: `C` },
          ],
        },
      },
    })
  })

  it(`should be retrieve all items reversed`, async () => {
    const result = await uc.execute(`query { dummies(sort: { name_DESC: 1 }) { total page { __typename id name } } } `)

    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            { __typename: 'Dummy', id: `3`, name: `C` },
            { __typename: 'Dummy', id: `2`, name: `B` },
            { __typename: 'Dummy', id: `1`, name: `A` },
          ],
        },
      },
    })
  })

  it(`should be retrieve all items reversed 2`, async () => {
    const result = await uc.execute(
      `query { dummies(sort: { name_DESC: 1, id_DESC: 2 }) { total page { __typename id name } } } `
    )

    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            { __typename: 'Dummy', id: `3`, name: `C` },
            { __typename: 'Dummy', id: `2`, name: `B` },
            { __typename: 'Dummy', id: `1`, name: `A` },
          ],
        },
      },
    })
  })
})
