import gql from 'graphql-tag'
import { printSchemaWithDirectives } from '@graphql-tools/utils'
import { createUnitTestContext } from './utils'

describe(`Build Cosmos AST Schema`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy!]! @cosmos
    }
    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID! @where(op: "eq")
      status: Status! @where(op: "eq neq")
      related: [Related!]! @cosmos(ours: "relatedIds", pagination: "on")
    }

    type Related @cosmos(database: "Test", container: "Relations") {
      id: ID! @where(op: "eq")
      name: String! @sort(ours: "test")
    }

    enum Status {
      OPEN
      CLOSE
    }
  `

  const responses = {}

  const uc = createUnitTestContext(dummyTypeDefs, responses)

  it(`expects schema to remain the same`, () => {
    const output = printSchemaWithDirectives(uc.schema)
    expect(output).toMatchSnapshot()
  })

  it(`expects meta schema to remain the same`, () => {
    const output = uc.metaSchema
    expect(output).toMatchSnapshot()
  })
})
