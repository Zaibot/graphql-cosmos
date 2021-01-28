import { buildASTSchema, buildSchema, concatAST, GraphQLSchema, printSchema, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema, mergeSchemas, SchemaDirectiveVisitor } from 'graphql-tools'
import { GraphQLCosmosSchema } from '../src/graphql/directive/schema'

import { preprocessSchema } from '../src/process-directives'
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

describe(`Processed schema`, () => {
  let output: string
  let dummy: GraphQLSchema

  beforeEach(() => {
    dummy = preprocessSchema(buildASTSchema(concatAST([dummyTypeDefs, GraphQLCosmosSchema.typeDefs])))
    expect(validateSchema(dummy)).toHaveLength(0)

    output = printSchema(dummy, { commentDescriptions: false })
    // console.log(output);
  })

  it(`should match expected`, () => {
    expect(normalize(output)).toBe(
      normalize(`
                type Query {
                    dummies(where: DummyWhere, cursor: String): DummyPage!
                }
            
                type Dummy {
                    id: ID!
                    status: Status!
                    related(where: RelatedWhere, sort: RelatedSort, cursor: String): RelatedPage!
                }
            
                type Related {
                    id: ID!
                    name: String!
                }
            
                enum Status {
                    OPEN
                    CLOSE
                }

                input DummyWhere {
                    id_eq: ID
                    status_eq: Status
                    status_neq: Status
                }
            
                type DummyPage {
                    nextCursor: String
                    total: Int!
                    page: [Dummy!]!
                }
            
                input RelatedWhere {
                    id_eq: ID
                }
            
                input RelatedSort {
                    name_ASC: Int
                    name_DESC: Int
                }
            
                type RelatedPage {
                    nextCursor: String
                    total: Int!
                    page: [Related!]!
                }
            `)
    )
  })
})

const normalize = (text: string) =>
  text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .join(`\n`)
