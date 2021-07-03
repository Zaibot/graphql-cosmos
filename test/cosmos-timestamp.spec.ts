import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Processed schema`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID! @where(op: "eq in")
      timestamp: Int @cosmos(ours: "_ts") @where(op: "gte")
      etag: String @cosmos(ours: "_etag") @where(op: "eq")
    }
  `

  const responses = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE c._etag = @p2 (@p2=abc)': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE c._ts >= @p2 (@p2=100)': [1],

      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }],
      'SELECT c.id FROM c WHERE c._etag = @p2 ORDER BY c.id (@p2=abc)': [{ id: `1` }],
      'SELECT c.id, c._ts, c._etag FROM c WHERE c._ts >= @p2 ORDER BY c.id (@p2=100)': [
        { id: `1`, _ts: 123, _etag: `abc` },
      ],

      'SELECT c.id, c._ts, c._etag FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1)': [
        { id: `1`, _ts: 123, _etag: `abc` },
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

  it(`should return _ts _etag properties`, async () => {
    const result = await uc.execute(`query { dummies { total page { id timestamp etag } } } `)

    expect(result).toEqual({
      data: {
        dummies: { total: 1, page: [{ id: `1`, timestamp: 123, etag: `abc` }] },
      },
    })
  })

  it(`should be retrieve all items`, async () => {
    const result = await uc.execute(
      `query { dummies(where: { etag_eq: "abc" }) { total page { id timestamp etag } } } `
    )

    expect(result).toEqual({
      data: {
        dummies: { total: 1, page: [{ id: `1`, timestamp: 123, etag: `abc` }] },
      },
    })
  })

  it(`should be retrieve all items`, async () => {
    const result = await uc.execute(
      `query { dummies(where: { timestamp_gte: 100 }) { total page { id timestamp etag } } } `
    )

    expect(result).toEqual({
      data: {
        dummies: { total: 1, page: [{ id: `1`, timestamp: 123, etag: `abc` }] },
      },
    })
  })
})
