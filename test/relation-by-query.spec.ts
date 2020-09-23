import { FeedResponse } from '@azure/cosmos';
import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration';
import { defaultDataLoader } from '../src/default';
import { CosmosDirective } from '../src/graphql/directive/cosmos/directive';
import { schema } from '../src/graphql/directive/schema';

const dummyTypeDefs = gql`
    type Query {
        dummies: [Dummy] @cosmos(container: "Dummies")
    }

    type Dummy {
        id: ID!
        related: [Related] @cosmos(container: "Relations", ours: "relatedIds")
    }

    type Related {
        id: ID!
        dummies: [Dummy] @cosmos(container: "Dummies", theirs: "relatedIds")
    }
`;

const onCosmosQuery = async ({ container, query, parameters }: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
    const id_in = parameters.find((x) => x.name === `@id_in`)?.value as string[] | undefined;
    const relatedIds_in = parameters.find((x) => x.name === `@relatedIds_in`)?.value as string[] | undefined;

    if (container === `Dummies` && query === `SELECT c.id FROM c ORDER BY c.id`) {
        return {
            resources: [{ id: `1` }, { id: `2` }, { id: `3` }],
        } as any;
    }
    if (container === `Dummies` && query === `SELECT r.id, r.relatedIds FROM r WHERE ARRAY_CONTAINS(@batch, r.id)`) {
        return {
            resources: [
                { id: `1`, relatedIds: [`1b`] },
                { id: `2`, relatedIds: [`2b`] },
                { id: `3`, relatedIds: [`3b`] },
            ],
        } as any;
    }
    if (container === `Relations` && query === `SELECT c.id FROM c WHERE ARRAY_CONTAINS(@id_in, c.id) ORDER BY c.id` && id_in?.toString() === `1b`) {
        return {
            resources: [{ id: `1b` }],
        } as any;
    }
    if (container === `Relations` && query === `SELECT c.id FROM c WHERE ARRAY_CONTAINS(@id_in, c.id) ORDER BY c.id` && id_in?.toString() === `2b`) {
        return {
            resources: [{ id: `2b` }],
        } as any;
    }
    if (container === `Relations` && query === `SELECT c.id FROM c WHERE ARRAY_CONTAINS(@id_in, c.id) ORDER BY c.id` && id_in?.toString() === `3b`) {
        return {
            resources: [{ id: `3b` }],
        } as any;
    }

    if (
        container === `Dummies` &&
        query === `SELECT c.id FROM c WHERE ARRAY_CONTAINS(@relatedIds_in, c.relatedIds) ORDER BY c.id` &&
        relatedIds_in?.toString() === `1b`
    ) {
        return {
            resources: [{ id: `1` }],
        } as any;
    }
    if (
        container === `Dummies` &&
        query === `SELECT c.id FROM c WHERE ARRAY_CONTAINS(@relatedIds_in, c.relatedIds) ORDER BY c.id` &&
        relatedIds_in?.toString() === `2b`
    ) {
        return {
            resources: [{ id: `2` }],
        } as any;
    }
    if (
        container === `Dummies` &&
        query === `SELECT c.id FROM c WHERE ARRAY_CONTAINS(@relatedIds_in, c.relatedIds) ORDER BY c.id` &&
        relatedIds_in?.toString() === `3b`
    ) {
        return {
            resources: [{ id: `3` }],
        } as any;
    }

    throw Error(`Unhandled: ${container} ${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString() || `no parameters`})`);
};

describe(`Reference to other container`, () => {
    let context: GraphQLCosmosContext;
    let dummy: GraphQLSchema;

    beforeEach(() => {
        context = {
            directives: {
                cosmos: { database: null as any, client: null as any, onQuery: onCosmosQuery, dataloader: defaultDataLoader(onCosmosQuery) },
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

    it(`should be retrieve all items`, async () => {
        const query = parse(`query { dummies { page { __typename id related { page { __typename id } } } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: {
                    page: [
                        { __typename: 'Dummy', id: `1`, related: { page: [{ __typename: 'Related', id: `1b` }] } },
                        { __typename: 'Dummy', id: `2`, related: { page: [{ __typename: 'Related', id: `2b` }] } },
                        { __typename: 'Dummy', id: `3`, related: { page: [{ __typename: 'Related', id: `3b` }] } },
                    ],
                },
            },
        });
    });

    it(`should be retrieve all items (theirs)`, async () => {
        const query = parse(`query { dummies { page { __typename id related { page { __typename id dummies { page { __typename id } } } } } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: {
                    page: [
                        {
                            __typename: 'Dummy',
                            id: `1`,
                            related: { page: [{ __typename: 'Related', id: `1b`, dummies: { page: [{ __typename: 'Dummy', id: `1` }] } }] },
                        },
                        {
                            __typename: 'Dummy',
                            id: `2`,
                            related: { page: [{ __typename: 'Related', id: `2b`, dummies: { page: [{ __typename: 'Dummy', id: `2` }] } }] },
                        },
                        {
                            __typename: 'Dummy',
                            id: `3`,
                            related: { page: [{ __typename: 'Related', id: `3b`, dummies: { page: [{ __typename: 'Dummy', id: `3` }] } }] },
                        },
                    ],
                },
            },
        });
    });
});
