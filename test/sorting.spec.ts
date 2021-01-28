import { FeedResponse } from '@azure/cosmos'
import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { makeExecutableSchema } from 'graphql-tools'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'
import { defaultDataLoader } from '../src/default'
import { GraphQLCosmosSchema } from '../src/graphql/directive/schema'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy] @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID! @sort
    name: String! @sort
  }
`

const onCosmosQuery = async ({
  container,
  query,
  parameters,
}: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
  const queryResult: Record<string, Record<string, number | unknown[]>> = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [3],
      'SELECT VALUE COUNT(1) FROM r WHERE ARRAY_CONTAINS(@batch, r.id)': [3],
      'SELECT c.id FROM c ORDER BY c.name, c.id': [{ id: `1` }, { id: `2` }, { id: `3` }],
      'SELECT r.id, r.name FROM r WHERE ARRAY_CONTAINS(@batch, r.id) ORDER BY r.name, r.id': [
        { id: `1`, name: `A` },
        { id: `2`, name: `B` },
        { id: `3`, name: `C` },
      ],
      'SELECT c.id FROM c ORDER BY c.name DESC, c.id': [{ id: `3` }, { id: `2` }, { id: `1` }],
      'SELECT r.id, r.name FROM r WHERE ARRAY_CONTAINS(@batch, r.id) ORDER BY r.name DESC, r.id': [
        { id: `3`, name: `C` },
        { id: `2`, name: `B` },
        { id: `1`, name: `A` },
      ],
      'SELECT c.id FROM c ORDER BY c.name DESC, c.id DESC, c.id': [{ id: `3` }, { id: `2` }, { id: `1` }],
      'SELECT c.id, c.name FROM c WHERE ARRAY_CONTAINS(@batch, c.id)': [
        { id: `3`, name: `C` },
        { id: `2`, name: `B` },
        { id: `1`, name: `A` },
      ],
    },
  }

  const result = queryResult[container]?.[query]
  if (result) {
    return { resources: result } as any
  } else {
    throw Error(
      `Unhandled: ${container} ${query} (${
        parameters.map((x) => `${x.name}=${x.value}`).toString() || `no parameters`
      })`
    )
  }
}

describe(`Sorting`, () => {
  let context: GraphQLCosmosContext
  let dummy: GraphQLSchema

  beforeEach(() => {
    const loader = defaultDataLoader()

    context = {
      directives: {
        cosmos: {
          database: null as any,
          client: null as any,
          onQuery: onCosmosQuery,
          dataloader: loader,
        },
      },
    }

    dummy = makeExecutableSchema({
      typeDefs: [GraphQLCosmosSchema.typeDefs, dummyTypeDefs],
      schemaDirectives: {
        ...GraphQLCosmosSchema.schemaDirectives,
      },
    })

    expect(validateSchema(dummy)).toHaveLength(0)
  })

  it(`should be retrieve all items`, async () => {
    const query = parse(`query { dummies(sort: { name_ASC: 1 }) { total page { __typename id name } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            { __typename: 'Dummy', id: `1`, name: `A` },
            { __typename: 'Dummy', id: `2`, name: `B` },
            { __typename: 'Dummy', id: `3`, name: `C` },
          ],
        },
      },
    })
  })

  it(`should be retrieve all items reversed`, async () => {
    const query = parse(`query { dummies(sort: { name_DESC: 1 }) { total page { __typename id name } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            { __typename: 'Dummy', id: `3`, name: `C` },
            { __typename: 'Dummy', id: `2`, name: `B` },
            { __typename: 'Dummy', id: `1`, name: `A` },
          ],
        },
      },
    })
  })

  it(`should be retrieve all items reversed 2`, async () => {
    const query = parse(`query { dummies(sort: { name_DESC: 1, id_DESC: 2 }) { total page { __typename id name } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            { __typename: 'Dummy', id: `3`, name: `C` },
            { __typename: 'Dummy', id: `2`, name: `B` },
            { __typename: 'Dummy', id: `1`, name: `A` },
          ],
        },
      },
    })
  })
})
