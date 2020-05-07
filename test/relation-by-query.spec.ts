import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/context';
import { CosmosDirective } from '../src/directive';
import { schema } from '../src/schema';

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
    }
`;

const onCosmosQuery = async ({ container, query, parameters }: GraphQLCosmosRequest) => {
    const id_in = parameters.find((x) => x.name === `@id_in`)?.value as string[] | undefined;

    if (container === `Dummies` && query === `SELECT * FROM c`) {
        return {
            resources: [
                { id: `1`, relatedIds: [`1b`] },
                { id: `2`, relatedIds: [`2b`] },
                { id: `3`, relatedIds: [`3b`] },
            ],
        };
    }
    if (container === `Relations` && query === `SELECT * FROM c WHERE ARRAY_CONTAINS(@id_in, c.id)` && id_in?.toString() === `1b`) {
        return {
            resources: [{ id: `1b` }],
        };
    }
    if (container === `Relations` && query === `SELECT * FROM c WHERE ARRAY_CONTAINS(@id_in, c.id)` && id_in?.toString() === `2b`) {
        return {
            resources: [{ id: `2b` }],
        };
    }
    if (container === `Relations` && query === `SELECT * FROM c WHERE ARRAY_CONTAINS(@id_in, c.id)` && id_in?.toString() === `3b`) {
        return {
            resources: [{ id: `3b` }],
        };
    }

    throw Error(`Unhandled: ${container} ${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString() || `no parameters`})`);
};

describe(`Reference to other container`, () => {
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
                cosmos: CosmosDirective,
            } as any,
        });

        expect(validateSchema(dummy)).toHaveLength(0);
    });

    it(`should be retrieve all items`, async () => {
        const query = parse(`query { dummies { __typename id related { __typename id } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: [
                    { __typename: 'Dummy', id: `1`, related: [{ __typename: 'Related', id: `1b` }] },
                    { __typename: 'Dummy', id: `2`, related: [{ __typename: 'Related', id: `2b` }] },
                    { __typename: 'Dummy', id: `3`, related: [{ __typename: 'Related', id: `3b` }] },
                ],
            },
        });
    });
});
