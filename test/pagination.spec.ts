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
        id: ID!
    }
`;

const onCosmosQuery = async ({ container, query, parameters }: GraphQLCosmosRequest) => {
    const queryResult: Record<string, Record<string, unknown[]>> = {
        Dummies: {
            'SELECT * FROM c ORDER BY c.id OFFSET 0 LIMIT 10': [{ id: `1` }, { id: `2` }, { id: `3` }],
            'SELECT * FROM c ORDER BY c.id OFFSET 0 LIMIT 1': [{ id: `1` }],
            'SELECT * FROM c ORDER BY c.id OFFSET 1 LIMIT 2': [{ id: `2` }, { id: `3` }],
        },
    };

    const result = queryResult[container]?.[query];
    if (result) {
        return { resources: result };
    } else {
        throw Error(`Unhandled: ${container} ${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString() || `no parameters`})`);
    }
};

describe(`Pagination`, () => {
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

    it(`all results`, async () => {
        const query = parse(`query { dummies(offset: 0, limit: 10) { __typename id } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: [
                    { __typename: 'Dummy', id: `1` },
                    { __typename: 'Dummy', id: `2` },
                    { __typename: 'Dummy', id: `3` },
                ],
            },
        });
    });

    it(`page one`, async () => {
        const query = parse(`query { dummies(offset: 0, limit: 1) { __typename id } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: [{ __typename: 'Dummy', id: `1` }],
            },
        });
    });

    it(`page two`, async () => {
        const query = parse(`query { dummies(offset: 1, limit: 2) { __typename id } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: [
                    { __typename: 'Dummy', id: `2` },
                    { __typename: 'Dummy', id: `3` },
                ],
            },
        });
    });
});
