import { buildASTSchema, GraphQLSchema, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { printSchemaWithDirectives } from '@graphql-tools/utils'

import { mergeTypeDefs } from '@graphql-tools/merge'

import { CosmosSchemaCompiler } from '../src/4-resolver-builder/4-schema-compiler'
import { CosmosTypeDefsCompiler } from '../src/4-resolver-builder/4-typedefs-compiler'
import { GraphQLCosmosSchema } from '../src/1-graphql/1-directives'

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
  let fromTypeDefs: GraphQLSchema
  let fromSchema: GraphQLSchema

  beforeEach(() => {
    fromTypeDefs = makeExecutableSchema(CosmosTypeDefsCompiler.fromTypeDefs(dummyTypeDefs))
    fromSchema = CosmosSchemaCompiler.fromSchema(
      buildASTSchema(mergeTypeDefs([GraphQLCosmosSchema.typeDefs, dummyTypeDefs]))
    ).schema

    expect(validateSchema(fromTypeDefs)).toHaveLength(0)
    expect(validateSchema(fromSchema)).toHaveLength(0)
  })

  it(`fromTypeDefs and fromSchema should output the same`, () => {
    const typedefs = printSchemaWithDirectives(fromTypeDefs)
    const schema = printSchemaWithDirectives(fromSchema)
    expect(typedefs).toMatch(schema)
  })

  it(`fromTypeDefs should match expected`, () => {
    const output = printSchemaWithDirectives(fromTypeDefs)
    expect(output).toMatchSnapshot()
  })

  it(`fromSchema should match expected`, () => {
    const output = printSchemaWithDirectives(fromTypeDefs)
    expect(output).toMatchSnapshot()
  })
})
