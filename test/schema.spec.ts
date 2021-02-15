import { GraphQLSchema, printSchema, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { buildCosmosASTSchema } from '../src/build'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy!]! @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID! @where(op: "eq")
    status: Status! @where(op: "eq neq in nin")
    related: [Related!]! @cosmos(container: "Relations", ours: "relatedIds")
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
    dummy = buildCosmosASTSchema(dummyTypeDefs)

    expect(validateSchema(dummy)).toHaveLength(0)
  })

  it(`should match expected`, () => {
    output = printSchema(dummy, { commentDescriptions: false })
    expect(output).toMatchSnapshot()
  })
})
