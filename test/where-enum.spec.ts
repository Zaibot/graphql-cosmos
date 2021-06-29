import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Where`, () => {
  const dummyTypeDefs = gql`
    type Query {
      entities: [Entity!]! @cosmos(database: "Test", container: "Entities")
    }

    type Entity {
      id: ID!
      status: Status! @where(op: "eq neq in nin")
    }

    enum Status {
      NONE
      OPEN
      CLOSE
    }
  `

  const responses = {
    Entities: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }],
      'SELECT c.id, c.status FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1,2)': [
        { __typename: 'Entity', id: `1`, status: `OPEN` },
        { __typename: 'Entity', id: `2`, status: `CLOSE` },
      ],
      'SELECT c.id, c.status FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1)': [
        { __typename: 'Entity', id: `1`, status: `OPEN` },
      ],
      'SELECT c.id, c.status FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=2)': [
        { __typename: 'Entity', id: `2`, status: `CLOSE` },
      ],
      'SELECT c.id FROM c WHERE c.status = @p2 ORDER BY c.id (@p2=OPEN)': [{ id: `1` }],
      'SELECT c.id FROM c WHERE c.status != @p2 ORDER BY c.id (@p2=OPEN)': [{ id: `2` }],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@p2, c.status) ORDER BY c.id (@p2=OPEN,CLOSE)': [
        { id: `1` },
        { id: `2` },
      ],
    },
  }

  const uc = createUnitTestContext(dummyTypeDefs, responses)

  it(`expects schema to remain the same`, () => {
    const output = printSchemaWithDirectives(uc.schema)
    expect(output).toMatchSnapshot()
  })

  it(`expects meta schema to remain the same`, () => {
    const output = uc.metaSchema
    expect(output).toMatchSnapshot()
  })

  it(`should retrieve all`, async () => {
    const result = await uc.execute(`query { entities { page { __typename id status } } }`)
    result.errors?.forEach((e) => console.error(e.path.join(`/`), e.stack))

    expect(result).toEqual({
      data: {
        entities: {
          page: [
            {
              __typename: 'Entity',
              id: `1`,
              status: `OPEN`,
            },
            {
              __typename: 'Entity',
              id: `2`,
              status: `CLOSE`,
            },
          ],
        },
      },
    })
  })

  it(`should retrieve all open`, async () => {
    const result = await uc.execute(`query { entities(where: { status_eq: OPEN }) { page { __typename id status } } }`)
    result.errors?.forEach((e) => console.error(e.path.join(`/`), e.stack))

    expect(result).toEqual({ data: { entities: { page: [{ __typename: 'Entity', id: `1`, status: `OPEN` }] } } })
  })

  it(`should retrieve all close`, async () => {
    const result = await uc.execute(`query { entities(where: { status_neq: OPEN }) { page { __typename id status } } }`)
    result.errors?.forEach((e) => console.error(e.path.join(`/`), e.stack))

    expect(result).toEqual({ data: { entities: { page: [{ __typename: 'Entity', id: `2`, status: `CLOSE` }] } } })
  })

  it(`should retrieve all open and close`, async () => {
    const result = await uc.execute(
      `query { entities(where: { status_in: [OPEN, CLOSE] }) { page { __typename id status } } }`
    )
    result.errors?.forEach((e) => console.error(e.path.join(`/`), e.stack))

    expect(result).toEqual({
      data: {
        entities: {
          page: [
            { __typename: 'Entity', id: `1`, status: `OPEN` },
            { __typename: 'Entity', id: `2`, status: `CLOSE` },
          ],
        },
      },
    })
  })
})
