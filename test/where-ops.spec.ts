import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Where Operations`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos(database: "Test", container: "Dummies")
    }

    type Dummy {
      id: ID!
      prop: String @where(op: "eq in")
    }
  `

  const responses = {
    Dummies: {
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@p2, c.prop) ORDER BY c.id (@p2=a,b)': [],
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

  it(`should be retrieve all which has one of`, async () => {
    const result = await uc.execute(`query { dummies(where: { prop_in: ["a", "b"] }) { page { __typename id } } }`)
    expect(result.errors ?? []).toHaveLength(0)
  })
})
