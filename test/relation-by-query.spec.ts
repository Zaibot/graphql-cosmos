import { FeedResponse } from '@azure/cosmos';
import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration';
import { toTraceString } from '../src/debug';
import { defaultDataLoader } from '../src/default';
import { schema } from '../src/graphql/directive/schema';

const dummyTypeDefs = gql`
  type Query {
    dummies: [Dummy!]! @cosmos(container: "Dummies")
  }

  type Dummy {
    id: ID!
    related: [Related!]! @cosmos(container: "Relations", ours: "relatedIds")
  }

  type Related {
    id: ID!
    dummies: [Dummy!]! @cosmos(container: "Dummies", theirs: "relatedIds")
  }
`;

const onCosmosQuery = async (request: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
  const { container, query, parameters } = request;
  const key = parameters.length ? `${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString()})` : query;

  const responses = {
    Dummies: {
      'SELECT VALUE COUNT(1) FROM c': [3],

      'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }, { id: `2` }, { id: `3` }],

      'SELECT r.id, r.relatedIds FROM r WHERE ARRAY_CONTAINS(@batch, r.id) (@batch=1)': [
        { id: `1`, relatedIds: [`1b`] },
      ],
      'SELECT r.id, r.relatedIds FROM r WHERE ARRAY_CONTAINS(@batch, r.id) (@batch=2)': [
        { id: `2`, relatedIds: [`2b`] },
      ],
      'SELECT r.id, r.relatedIds FROM r WHERE ARRAY_CONTAINS(@batch, r.id) (@batch=3)': [
        { id: `3`, relatedIds: [`3b`] },
      ],

      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@relatedIds_in, c.relatedIds) ORDER BY c.id (@relatedIds_in=1b)': [
        { id: `1` },
      ],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@relatedIds_in, c.relatedIds) ORDER BY c.id (@relatedIds_in=2b)': [
        { id: `2` },
      ],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@relatedIds_in, c.relatedIds) ORDER BY c.id (@relatedIds_in=3b)': [
        { id: `3` },
      ],

      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@relatedIds_in, c.relatedIds) (@relatedIds_in=1b)': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@relatedIds_in, c.relatedIds) (@relatedIds_in=2b)': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@relatedIds_in, c.relatedIds) (@relatedIds_in=3b)': [1],
    },
    Relations: {
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@id_in, c.id) (@id_in=1b)': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@id_in, c.id) (@id_in=2b)': [1],
      'SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@id_in, c.id) (@id_in=3b)': [1],

      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@id_in, c.id) ORDER BY c.id (@id_in=1b)': [{ id: `1b` }],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@id_in, c.id) ORDER BY c.id (@id_in=2b)': [{ id: `2b` }],
      'SELECT c.id FROM c WHERE ARRAY_CONTAINS(@id_in, c.id) ORDER BY c.id (@id_in=3b)': [{ id: `3b` }],
    },
  };

  const result = responses[container]?.[key];
  if (result) {
    return { resources: result } as any;
  } else {
    throw Error(`Unhandled: ${container} ${key}`);
  }
};

describe(`Reference to other container`, () => {
  let context: GraphQLCosmosContext;
  let dummy: GraphQLSchema;

  beforeEach(() => {
    context = {
      directives: {
        cosmos: {
          database: null as any,
          client: null as any,
          onQuery: onCosmosQuery,
          dataloader: defaultDataLoader(onCosmosQuery),
        },
      },
    };

    dummy = makeExecutableSchema({
      typeDefs: [schema.typeDefs, dummyTypeDefs],
      schemaDirectives: {
        ...schema.schemaDirectives,
      },
    });

    expect(validateSchema(dummy)).toHaveLength(0);
  });

  it(`should be retrieve all items (root)`, async () => {
    const query = parse(`query { dummies { total page { __typename id } } } `);
    const result = await execute(dummy, query, undefined, context);
    if (result.errors?.length) {
      result.errors.forEach((e) => console.error(e.path.join(`/`), e.stack));
    }

    expect(validate(dummy, query)).toHaveLength(0);
    expect(result).toEqual({
      data: {
        dummies: {
          total: 3,
          page: [
            { __typename: 'Dummy', id: `1` },
            { __typename: 'Dummy', id: `2` },
            { __typename: 'Dummy', id: `3` },
          ],
        },
      },
    });
  });

  it(`should be retrieve all items (ours)`, async () => {
    const query = parse(`query { dummies { total page { __typename id related { total page { __typename id } } } } } `);
    const result = await execute(dummy, query, undefined, context);
    if (result.errors?.length) {
      result.errors.forEach((e) => console.error(e.path.join(`/`), e.stack));
    }

    expect(validate(dummy, query)).toHaveLength(0);
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
                page: [{ __typename: 'Related', id: `1b` }],
              },
            },
            {
              __typename: 'Dummy',
              id: `2`,
              related: {
                total: 1,
                page: [{ __typename: 'Related', id: `2b` }],
              },
            },
            {
              __typename: 'Dummy',
              id: `3`,
              related: {
                total: 1,
                page: [{ __typename: 'Related', id: `3b` }],
              },
            },
          ],
        },
      },
    });
  });

  it(`should be retrieve all items (theirs)`, async () => {
    const query = parse(
      `query { dummies { total page { __typename id related { total page { __typename id dummies { total page { __typename id } } } } } } } `
    );
    const result = await execute(dummy, query, undefined, context);
    if (result.errors?.length) {
      result.errors.forEach((e) => console.error(e.path.join(`/`), e.stack));
    }

    expect(validate(dummy, query)).toHaveLength(0);
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
    });
  });
});
