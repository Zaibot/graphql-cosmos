import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Data Loader`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos(database: "Test", container: "Dummies")
    }

    type Dummy {
      id: ID! @where(op: "eq in")
      related: Related @cosmos(database: "Test", container: "Relations", ours: "relatedId")
    }

    type Related {
      id: ID!
      text: String
    }
  `

  const responses = {
    Dummies: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }],
      'SELECT c.id, c.relatedId FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1,2,3)': [
        { id: `1`, relatedId: `1b` },
        { id: `2`, relatedId: `2b` },
        { id: `3`, relatedId: `3b` },
      ],

      'SELECT VALUE COUNT(1) FROM c WHERE c.id = @p2 (@p2=missing)': [0],
      'SELECT c.id FROM c WHERE c.id = @p2 ORDER BY c.id (@p2=missing)': [],
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@p2, c.id) (@p2=missing1,missing2)': [0],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=missing1,missing2)': [],
    },
    Relations: {
      'SELECT c.id, c.text FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1b,2b,3b)': [
        { id: `1b`, text: null },
        { id: `2b`, text: null },
        { id: `3b`, text: null },
      ],
    },
  }

  const uc = createUnitTestContext(dummyTypeDefs, responses)

  let dataloader: string[]
  const original = uc.context.dataSources.graphqlCosmos.dataloader

  beforeEach(() => {
    dataloader = []
    uc.context.dataSources.graphqlCosmos.dataloader = (spec) => {
      if (spec.container === `Relations`) {
        dataloader.splice(dataloader.length, 0, ...spec.id)
        return original(spec)
      } else {
        return original(spec)
      }
    }
  })

  it(`expects schema to remain the same`, () => {
    const output = printSchemaWithDirectives(uc.schema)
    expect(output).toMatchSnapshot()
  })

  it(`expects meta schema to remain the same`, () => {
    const output = uc.metaSchema
    expect(output).toMatchSnapshot()
  })

  it(`should be retrieve all items`, async () => {
    const result = await uc.execute(`query { dummies { page { related { id text } } } } `)

    expect(result).toEqual({
      data: {
        dummies: {
          page: [
            { related: { id: `1b`, text: null } },
            { related: { id: `2b`, text: null } },
            { related: { id: `3b`, text: null } },
          ],
        },
      },
    })
    expect(dataloader).toEqual([`1b`, `2b`, `3b`])
  })

  it(`should return null on missing single`, async () => {
    const result = await uc.execute(
      `query { dummies(where: { id_eq: "missing" }) { total page { id related { id } } } } `
    )

    expect(result).toEqual({
      data: { dummies: { total: 0, page: [] } },
    })
  })

  it(`should return null on missing many`, async () => {
    const result = await uc.execute(
      `query { dummies(where: { id_in: ["missing1", "missing2"] }) { total page { id related { id } } } } `
    )

    expect(result).toEqual({
      data: { dummies: { total: 0, page: [] } },
    })
  })
})
