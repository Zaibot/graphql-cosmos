import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql'
import gql from 'graphql-tag'
import { buildCosmosASTSchema } from '../src/build'
import { GraphQLCosmosContext } from '../src/configuration'

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy] @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID! @where(op: "eq")
  }
`

const onCosmosQuery = async ({ query }) => {
  const c = {
    'SELECT VALUE COUNT(1) FROM c': { resources: [3] },
    'SELECT VALUE COUNT(1) FROM c WHERE c.id = @id_eq': { resources: [1] },
    'SELECT c.id FROM c WHERE c.id = @id_eq ORDER BY c.id': {
      resources: [{ id: `1` }],
    },
    'SELECT c.id FROM c ORDER BY c.id': {
      resources: [{ id: `1` }, { id: `2` }, { id: `3` }],
    },
  }
  if (c[query]) {
    return c[query]
  } else {
    throw Error(`Unhandled: ${query}`)
  }
}

describe(`@cosmos`, () => {
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

  it(`should be retrieve all items`, async () => {
    const query = parse(`query { dummies { total page { id } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: {
        dummies: { total: 3, page: [{ id: `1` }, { id: `2` }, { id: `3` }] },
      },
    })
  })

  it(`should be able to filter on id`, async () => {
    const query = parse(`query { dummies(where: { id_eq: "1" }) { total page { id } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: { dummies: { total: 1, page: [{ id: `1` }] } },
    })
  })

  it(`should be able to filter on id`, async () => {
    const query = parse(`query { dummies(where: { id_eq: "1" }) { total page { id } } } `)
    const result = await execute(dummy, query, undefined, context)

    expect(validate(dummy, query)).toHaveLength(0)
    expect(result).toEqual({
      data: { dummies: { total: 1, page: [{ id: `1` }] } },
    })
  })
})
