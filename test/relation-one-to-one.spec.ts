import { execute, GraphQLSchema, parse, validate, validateSchema } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLCosmosContext, GraphQLCosmosRequest } from '../src/configuration';
import { CosmosDirective } from '../src/graphql/directive/cosmos/directive';
import { schema } from '../src/graphql/directive/schema';

const dummyTypeDefs = gql`
    type Query {
        lefts: [Left] @cosmos(container: "Lefts")
    }

    type Left {
        id: ID!
        right: Right @cosmos(container: "Rights", ours: "rightId")
    }

    type Right {
        id: ID!
    }
`;

const onCosmosQuery = async ({ container, query, parameters }: GraphQLCosmosRequest) => {
    const queryResult: Record<string, Record<string, unknown[]>> = {
        Lefts: {
            'SELECT * FROM c ORDER BY c.id': [{ id: `l`, rightId: `r` }],
        },
        Rights: {
            'SELECT * FROM c WHERE c.id = @id_eq ORDER BY c.id': [{ id: `r` }],
        },
    };

    const result = queryResult[container]?.[query];
    if (result) {
        return { resources: result };
    } else {
        throw Error(`Unhandled: ${container} ${query} (${parameters.map((x) => `${x.name}=${x.value}`).toString() || `no parameters`})`);
    }
};

describe(`One to one`, () => {
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
        const query = parse(`query { lefts { __typename id right { __typename id } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                lefts: [{ __typename: 'Left', id: `l`, right: { __typename: 'Right', id: `r` } }],
            },
        });
    });
});
