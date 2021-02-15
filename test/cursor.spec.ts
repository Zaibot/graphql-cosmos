import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { buildCosmosASTSchema } from '../src/build'
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy] @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID!
  }
`

const onCosmosQuery = async ({ container, query, parameters, options }: GraphQLCosmosRequest) => {
  const queryResult: Record<string, Record<string, unknown[]>> = {
    Dummies: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }],
      'SELECT c.id FROM c ORDER BY c.id @1': [{ id: `2` }, { id: `3` }],
    },
  }
  const nextCursor: Record<string, Record<string, string>> = {
    Dummies: {
      'SELECT c.id FROM c ORDER BY c.id': `1`,
    },
  }
  const cursor = options?.continuationToken ? ` @${options.continuationToken}` : ``
  const resources = queryResult[container]?.[`${query}${cursor}`]
  const continuationToken = nextCursor[container]?.[query]
  if (resources) {
    return { resources, continuationToken }
  } else {
    throw Error(
      `Unhandled: ${container} ${query} (${
        parameters.map((x) => `${x.name}=${x.value}`).toString() || `no parameters`
      })`
    )
  }
}

describe(`Pagination`, () => {
  let context: GraphQLCosmosContext
  let dummy: GraphQLSchema

  beforeEach(() => {
    context = {
      directives: {
        cosmos: { onQuery: onCosmosQuery } as any,
      },
    }

    dummy = buildCosmosASTSchema(dummyTypeDefs)

    expect(validateSchema(dummy)).toHaveLength(0)
  })

  it(`returns part one`, async () => {
    const query = parse(`query { dummies { nextCursor page { __typename id } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        dummies: {
          nextCursor: `1`,
          page: [{ __typename: 'Dummy', id: `1` }],
        },
      },
    })
  })

  it(`returns part two`, async () => {
    const query = parse(`query { dummies(cursor: "1") { page { __typename id } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        dummies: {
          page: [
            { __typename: 'Dummy', id: `2` },
            { __typename: 'Dummy', id: `3` },
          ],
        },
      },
    })
  })
})
