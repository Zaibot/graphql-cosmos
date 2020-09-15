import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql';
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
        id: ID! @sort
        name: String! @sort
    }
`;

const onCosmosQuery = async ({ container, query, parameters }: GraphQLCosmosRequest) => {
    const queryResult: Record<string, Record<string, unknown[]>> = {
        Dummies: {
            'SELECT * FROM c ORDER BY c.name, c.id': [
                { id: `1`, name: `A` },
                { id: `2`, name: `B` },
                { id: `3`, name: `C` },
            ],
            'SELECT * FROM c ORDER BY c.name DESC, c.id': [
                { id: `3`, name: `C` },
                { id: `2`, name: `B` },
                { id: `1`, name: `A` },
            ],
            'SELECT * FROM c ORDER BY c.name DESC, c.id DESC, c.id': [
                { id: `3`, name: `C` },
                { id: `2`, name: `B` },
                { id: `1`, name: `A` },
            ],
        },
    };

    const result = queryResult[container]?.[query];
    if (result) {
        return { resources: result };
    } else {
        throw Error(`Unhandled: ${container} ${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString() || `no parameters`})`);
    }
};

describe(`Sorting`, () => {
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
        const query = parse(`query { dummies(sort: { name_ASC: 1 }) { page { __typename id name } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: {
                    page: [
                        { __typename: 'Dummy', id: `1`, name: `A` },
                        { __typename: 'Dummy', id: `2`, name: `B` },
                        { __typename: 'Dummy', id: `3`, name: `C` },
                    ],
                },
            },
        });
    });

    it(`should be retrieve all items reversed`, async () => {
        const query = parse(`query { dummies(sort: { name_DESC: 1 }) { page { __typename id name } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: {
                    page: [
                        { __typename: 'Dummy', id: `3`, name: `C` },
                        { __typename: 'Dummy', id: `2`, name: `B` },
                        { __typename: 'Dummy', id: `1`, name: `A` },
                    ],
                },
            },
        });
    });

    it(`should be retrieve all items reversed 2`, async () => {
        const query = parse(`query { dummies(sort: { name_DESC: 1, id_DESC: 2 }) { page { __typename id name } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: {
                    page: [
                        { __typename: 'Dummy', id: `3`, name: `C` },
                        { __typename: 'Dummy', id: `2`, name: `B` },
                        { __typename: 'Dummy', id: `1`, name: `A` },
                    ],
                },
            },
        });
    });
});
