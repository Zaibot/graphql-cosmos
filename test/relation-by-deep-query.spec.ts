import { FeedResponse } from '@azure/cosmos';
import { execute, GraphQLSchema, validate, validateSchema } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration';
import { defaultDataLoader } from '../src/default';
import { schema } from '../src/graphql/directive/schema';

const dummyTypeDefs = gql`
    type Query {
        dummies: [Dummy] @cosmos(container: "Dummies")
    }

    type Dummy {
        id: ID! @where(op: "eq")
        related: [Related] @cosmos(container: "Relations", ours: "relatedIds")
    }

    type Related {
        id: ID! @where(op: "eq")
    }
`;

const onCosmosQuery = async ({ container, query, parameters }: GraphQLCosmosRequest): Promise<FeedResponse<unknown>> => {
    const queryResult: Record<string, Record<string, unknown[]>> = {
        Dummies: {
            'SELECT c.id FROM c ORDER BY c.id': [{ id: `1` }],
            'SELECT r.id, r.relatedIds FROM r WHERE ARRAY_CONTAINS(@batch, r.id)': [{ id: `1`, relatedIds: [`1b`, `2b`] }],
        },
        Relations: {
            'SELECT c.id FROM c WHERE c.id = @id_eq AND ARRAY_CONTAINS(@id_in, c.id) ORDER BY c.id': [{ id: `1b` }],
        },
    };

    const result = queryResult[container]?.[query];
    if (result) {
        return { resources: result } as any;
    } else {
        throw Error(`Unhandled: ${container} ${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString() || `no parameters`})`);
    }
};

describe(`Reference to deep container`, () => {
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
        const query = gql`
            query {
                dummies {
                    page {
                        __typename
                        id
                        related(where: { id_eq: "1b" }) {
                            page {
                                __typename
                                id
                            }
                        }
                    }
                }
            }
        `;
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: { page: [{ __typename: 'Dummy', id: `1`, related: { page: [{ __typename: 'Related', id: `1b` }] } }] },
            },
        });
    });
});
