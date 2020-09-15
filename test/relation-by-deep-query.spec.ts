import { execute, GraphQLSchema, validate, validateSchema } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration';
import { CosmosDirective } from '../src/graphql/directive/cosmos/directive';
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

const onCosmosQuery = async ({ container, query, parameters }: GraphQLCosmosRequest) => {
    const queryResult: Record<string, Record<string, unknown[]>> = {
        Dummies: {
            'SELECT * FROM c ORDER BY c.id': [{ id: `1`, relatedIds: [`1b`, `2b`] }],
        },
        Relations: {
            'SELECT * FROM c WHERE c.id = @id_eq AND ARRAY_CONTAINS(@id_in, c.id) ORDER BY c.id': [{ id: `1b` }],
        },
    };

    const result = queryResult[container]?.[query];
    if (result) {
        return { resources: result };
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
                cosmos: { onQuery: onCosmosQuery } as any,
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
                    __typename
                    id
                    related(where: { id_eq: "1b" }) {
                        __typename
                        id
                    }
                }
            }
        `;
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: [{ __typename: 'Dummy', id: `1`, related: [{ __typename: 'Related', id: `1b` }] }],
            },
        });
    });
});
