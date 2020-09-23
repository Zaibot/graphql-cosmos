import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLCosmosContext } from '../src/configuration';
import { CosmosDirective } from '../src/graphql/directive/cosmos/directive';
import { schema } from '../src/graphql/directive/schema';

const dummyTypeDefs = gql`
    type Query {
        dummies: [Dummy] @cosmos(container: "Dummies")
    }

    type Dummy {
        id: ID! @where(op: "eq")
    }
`;

const onCosmosQuery = async ({ query }) => {
    if (query === `SELECT c.id FROM c WHERE c.id = @id_eq ORDER BY c.id`) {
        return { resources: [{ id: `1` }] };
    }
    if (query === `SELECT c.id FROM c ORDER BY c.id`) {
        return {
            resources: [{ id: `1` }, { id: `2` }, { id: `3` }],
        };
    }
    throw Error(`Unhandled: ${query}`);
};

describe(`@cosmos`, () => {
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
        const query = parse(`query { dummies { page { id } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({ data: { dummies: { page: [{ id: `1` }, { id: `2` }, { id: `3` }] } } });
    });

    it(`should be able to filter on id`, async () => {
        const query = parse(`query { dummies(where: { id_eq: "1" }) { page { id } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({ data: { dummies: { page: [{ id: `1` }] } } });
    });

    it(`should be able to filter on id`, async () => {
        const query = parse(`query { dummies(where: { id_eq: "1" }) { page { id } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({ data: { dummies: { page: [{ id: `1` }] } } });
    });
});
