import gql from 'graphql-tag'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { createUnitTestContext } from './utils'

describe(`Where`, () => {
  const dummyTypeDefs = gql`
    type Query {
      entities: [Entity!]! @cosmos
    }

    type Entity @cosmos(database: "Test", container: "Entities") {
      id: ID!
      related: Related @cosmos(ours: "relatedId") @where(op: "eq", ours: "relatedId")
    }

    type Related @cosmos(database: "Test", container: "Related") {
      id: ID!
      text: String
    }
  `

  const responses = {
    Entities: {
      'SELECT c.id, c.relatedId FROM c ORDER BY c.id': [
        { id: `1`, relatedId: `1a` },
        { id: `2`, relatedId: `2b` },
      ],
      'SELECT c.id, c.relatedId FROM c WHERE c.relatedId = @p2 ORDER BY c.id (@p2=1a)': [{ id: `1` }],
      'SELECT c.id, c.relatedId FROM c WHERE c.id = @p2 ORDER BY c.id (@p2=1)': [{ id: `1`, relatedId: `1a` }],
    },
    Related: {
      'SELECT c.id, c.text FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1a,2b)': [
        { id: `1a`, text: `a` },
        { id: `2b`, text: `b` },
      ],
      'SELECT c.id, c.text FROM c WHERE c.id = @p2 ORDER BY c.id (@p2=1a)': [{ id: `1a`, text: `a` }],
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

  it(`should retrieve all`, async () => {
    const result = await uc.execute(`query { entities { page { __typename id related { __typename id text } } } }`)
    result.errors?.forEach((e) => console.error(e.path.join(`/`), e.stack))

    expect(result).toEqual({
      data: {
        entities: {
          page: [
            {
              __typename: 'Entity',
              id: `1`,
              related: {
                __typename: 'Related',
                id: `1a`,
                text: `a`,
              },
            },
            {
              __typename: 'Entity',
              id: `2`,
              related: {
                __typename: 'Related',
                id: `2b`,
                text: `b`,
              },
            },
          ],
        },
      },
    })
  })

  it(`should retrieve 1a`, async () => {
    const result = await uc.execute(
      `query { entities(where: { relatedId_eq: "1a" }) { page { __typename id related { __typename id text } } } }`
    )
    result.errors?.forEach((e) => console.error(e.path.join(`/`), e.stack))

    expect(result).toEqual({
      data: {
        entities: {
          page: [
            {
              __typename: 'Entity',
              id: `1`,
              related: {
                __typename: 'Related',
                id: `1a`,
                text: `a`,
              },
            },
          ],
        },
      },
    })
  })
})
