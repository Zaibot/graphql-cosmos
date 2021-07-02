import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Data Loader`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID!
      related: [Related] @cosmos(ours: "relatedIds", pagination: "on")
    }

    type Related @cosmos(database: "Test", container: "Relations") {
      id: ID! @where(op: "eq")
      text: String
    }
  `

  const responses = {
    Dummies: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }],
      'SELECT c.id, c.relatedIds FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1,2,3)': [
        { id: `1`, relatedIds: [`1a`, `1b`] },
        { id: `2`, relatedIds: [`2a`, `2b`] },
        { id: `3`, relatedIds: [`3a`, `3b`] },
      ],
    },
    Relations: {
      'SELECT c.id, c.text FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1a,1b,2a,2b,3a,3b)': [
        { id: `1a`, text: `1` },
        { id: `1b`, text: `1` },
        { id: `2a`, text: `2` },
        { id: `2b`, text: null },
        { id: `3a`, text: null },
        { id: `3b`, text: null },
      ],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1a,1b)': [{ id: `1a` }, { id: `1b` }],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=2a,2b)': [{ id: `2a` }, { id: `2b` }],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=3a,3b)': [{ id: `3a` }, { id: `3b` }],
      'SELECT c.id, c.text FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1a,1b)': [
        { id: `1a`, text: `1` },
        { id: `1b`, text: `1` },
      ],
      'SELECT c.id, c.text FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=2a,2b)': [
        { id: `2a`, text: `2` },
        { id: `2b`, text: null },
      ],
      'SELECT c.id, c.text FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=3a,3b)': [
        { id: `3a`, text: null },
        { id: `3b`, text: null },
      ],
    },
  }

  const uc = createUnitTestContext(dummyTypeDefs, responses)

  let dataloader: string[] = []
  const original = uc.context.dataSources.graphqlCosmos.dataloader
  uc.context.dataSources.graphqlCosmos.dataloader = (spec) => {
    if (spec.container === `Relations`) {
      dataloader.splice(dataloader.length, 0, ...spec.id)
      return original(spec)
    } else {
      return original(spec)
    }
  }

  it(`expects schema to remain the same`, () => {
    const output = printSchemaWithDirectives(uc.schema)
    expect(output).toMatchSnapshot()
  })

  it(`expects meta schema to remain the same`, () => {
    const output = uc.metaSchema
    expect(output).toMatchSnapshot()
  })

  it(`should be retrieve all items`, async () => {
    const result = await uc.execute(`query { dummies { page { related { page { id text } } } } } `)

    expect(result).toEqual({
      data: {
        dummies: {
          page: [
            {
              related: {
                page: [
                  { id: `1a`, text: `1` },
                  { id: `1b`, text: `1` },
                ],
              },
            },
            {
              related: {
                page: [
                  { id: `2a`, text: `2` },
                  { id: `2b`, text: null },
                ],
              },
            },
            {
              related: {
                page: [
                  { id: `3a`, text: null },
                  { id: `3b`, text: null },
                ],
              },
            },
          ],
        },
      },
    })
    expect(dataloader).toEqual([`1a`, `1b`, `2a`, `2b`, `3a`, `3b`])
  })
})
