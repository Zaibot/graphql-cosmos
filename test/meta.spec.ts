import gql from 'graphql-tag'
import { getGraphQLCosmosSchemaFromGraphQL } from '../src/2-meta/1-ast'
import { getMetaSchema } from '../src/2-meta/2-intermediate'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy] @cosmos
  }

  type Dummy @cosmos(database: "Test", container: "Dummies") {
    id: ID! @where(op: "eq in")
    text: String
  }
`

describe(`@cosmos`, () => {
  it(`should be retrieve all items`, async () => {
    const meta = getMetaSchema(getGraphQLCosmosSchemaFromGraphQL(dummyTypeDefs))

    expect(meta).toMatchSnapshot()
  })
})
