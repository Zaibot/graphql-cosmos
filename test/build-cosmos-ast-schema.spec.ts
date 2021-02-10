import { GraphQLSchema, printSchema, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { buildCosmosASTSchema } from '../src/build'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy!]! @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID! @where(op: "eq")
    status: Status! @where(op: "eq neq")
    related: [Related!]! @cosmos(container: "Relations", ours: "relatedIds")
  }

  type Related {
    id: ID! @where(op: "eq")
    name: String! @sort(ours: "test")
  }

  enum Status {
    OPEN
    CLOSE
  }
`

describe(`Build Cosmos AST Schema`, () => {
  let output: string
  let dummy: GraphQLSchema

  beforeEach(() => {
    dummy = buildCosmosASTSchema(dummyTypeDefs)
    expect(validateSchema(dummy)).toHaveLength(0)

    output = printSchema(dummy, { commentDescriptions: false })
  })

  it(`should match expected`, () => {
    expect(output).toMatchSnapshot()
  })
})
