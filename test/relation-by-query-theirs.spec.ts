import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Reference to other container (theirs)`, () => {
  const dummyTypeDefs = gql`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID!
      related: [Related] @cosmos(ours: "relatedIds", pagination: "on")
    }

    type Related @cosmos(database: "Test", container: "Relations") {
      id: ID!
      dummies: [Dummy] @cosmos(theirs: "relatedIds")
    }
  `

  const responses = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [3],
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }],
      'SELECT c.id, c.relatedIds FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1,2,3)': [
        { id: `1`, relatedIds: [`1b`] },
        { id: `2`, relatedIds: [`2b`] },
        { id: `3`, relatedIds: [`3b`] },
      ],

      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(c.relatedIds, @p2) (@p2=1b)': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(c.relatedIds, @p2) (@p2=2b)': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(c.relatedIds, @p2) (@p2=3b)': [1],

      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(c.relatedIds, @p2) ORDER BY c.id (@p2=1b)': [{ id: `1` }],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(c.relatedIds, @p2) ORDER BY c.id (@p2=2b)': [{ id: `2` }],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(c.relatedIds, @p2) ORDER BY c.id (@p2=3b)': [{ id: `3` }],
    },
    Relations: {
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@p2, c.id) (@p2=1b)': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@p2, c.id) (@p2=2b)': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@p2, c.id) (@p2=3b)': [1],

      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=1b)': [{ id: `1b` }],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=2b)': [{ id: `2b` }],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=3b)': [{ id: `3b` }],
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

  it(`should be retrieve all items (theirs)`, async () => {
    const result = await uc.execute(
      `query { dummies { total page { __typename id related { total page { __typename id dummies { total page { __typename id } } } } } } } `
    )
    if (result.errors?.length) {
      result.errors.forEach((e) => console.error(e.path.join(`/`), e.stack))
    }

    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            {
              __typename: 'Dummy',
              id: `1`,
              related: {
                total: 1,
                page: [
                  {
                    __typename: 'Related',
                    id: `1b`,
                    dummies: {
                      total: 1,
                      page: [{ __typename: 'Dummy', id: `1` }],
                    },
                  },
                ],
              },
            },
            {
              __typename: 'Dummy',
              id: `2`,
              related: {
                total: 1,
                page: [
                  {
                    __typename: 'Related',
                    id: `2b`,
                    dummies: {
                      total: 1,
                      page: [{ __typename: 'Dummy', id: `2` }],
                    },
                  },
                ],
              },
            },
            {
              __typename: 'Dummy',
              id: `3`,
              related: {
                total: 1,
                page: [
                  {
                    __typename: 'Related',
                    id: `3b`,
                    dummies: {
                      total: 1,
                      page: [{ __typename: 'Dummy', id: `3` }],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    })
  })
})
