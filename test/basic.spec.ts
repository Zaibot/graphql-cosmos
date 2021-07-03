import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`@cosmos`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID! @where(op: "eq in")
      text: String
    }
  `

  const responses = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [3],
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }],
      'SELECT c.id FROM c WHERE c.id = @p2 ORDER BY c.id (@p2=1)': [{ id: `1` }],
      'SELECT VALUE COUNT(1) FROM c WHERE c.id = @p2 (@p2=1)': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE c.id = @p2 (@p2=missing)': [0],
      'SELECT c.id, c.text FROM c WHERE c.id = @p2 ORDER BY c.id (@p2=missing)': [],
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@p2, c.id) (@p2=missing1,missing2)': [0],
      'SELECT c.id, c.text FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=missing1,missing2)': [],
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
    const result = await uc.execute(`query { dummies { total page { id } } } `)

    expect(result).toEqual({
      data: {
        dummies: { total: 3, page: [{ id: `1` }, { id: `2` }, { id: `3` }] },
      },
    })
  })

  it(`should be able to filter on id`, async () => {
    const result = await uc.execute(`query { dummies(where: { id_eq: "1" }) { total page { id } } } `)
    expect(result).toEqual({
      data: { dummies: { total: 1, page: [{ id: `1` }] } },
    })
  })

  it(`should be able to filter on id`, async () => {
    const result = await uc.execute(`query { dummies(where: { id_eq: "1" }) { total page { id } } } `)
    expect(result).toEqual({
      data: { dummies: { total: 1, page: [{ id: `1` }] } },
    })
  })

  it(`should return null on missing single`, async () => {
    const result = await uc.execute(`query { dummies(where: { id_eq: "missing" }) { total page { id text } } } `)
    expect(result).toEqual({
      data: { dummies: { total: 0, page: [] } },
    })
  })

  it(`should return null on missing many`, async () => {
    const result = await uc.execute(
      `query { dummies(where: { id_in: ["missing1", "missing2"] }) { total page { id text } } } `
    )
    expect(result).toEqual({
      data: { dummies: { total: 0, page: [] } },
    })
  })
})
