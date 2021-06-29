import { GraphQLSchema, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { CosmosDefaultCompiler } from '../src/4-resolver-builder/4-default-compiler'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy!]! @cosmos(database: "Test", container: "Dummies")
  }

  type Dummy {
    id: ID! @where(op: "eq")
    status: Status! @where(op: "eq neq in nin")
    related: [Related!]! @cosmos(database: "Test", container: "Relations", ours: "relatedIds", pagination: "on")
  }

  type Related {
    id: ID! @where(op: "eq")
    name: String! @sort(ours: "test")
  }

  enum Status {
    NONE
    OPEN
    CLOSE
  }
`

describe(`Processed schema`, () => {
  let output: string
  let dummy: GraphQLSchema

  beforeEach(() => {
    dummy = CosmosDefaultCompiler.fromTypeDefs(dummyTypeDefs).schema

    expect(validateSchema(dummy)).toHaveLength(0)
  })

  it(`should match expected`, () => {
    output = printSchemaWithDirectives(dummy)
    expect(output).toMatchSnapshot()
  })
})
