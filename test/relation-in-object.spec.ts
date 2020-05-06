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
        embedded: [Embedded]
        related: [Related] @cosmos(container: "Relations", field: "relatedIds")
    }

    type Embedded {
        id: ID!
    }

    type Related {
        id: ID!
    }
`;

const onCosmosQuery = async ({ container, query, parameters }: GraphQLCosmosRequest) => {
    const queryResult: Record<string, Record<string, unknown[]>> = {
        Dummies: {
            'SELECT * FROM c WHERE c.id = @id_': [{ id: `1`, embedded: [{ id: `1b` }] }],
            'SELECT * FROM c': [
                { id: `1`, embedded: [{ id: `1b` }] },
                { id: `2`, embedded: [{ id: `2b` }] },
                { id: `3`, embedded: [{ id: `3b` }] },
            ],
        },
    };

    const result = queryResult[container]?.[query];
    if (result) {
        return { resources: result };
    } else {
        throw Error(`Unhandled: ${container} ${query} (${parameters.map((x) => `${x.name}=${x.value}`)})`);
    }
};

describe(`Embedded relations`, () => {
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
        const query = parse(`query { dummies { __typename id embedded { __typename id } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: [
                    { __typename: 'Dummy', id: `1`, embedded: [{ __typename: 'Embedded', id: `1b` }] },
                    { __typename: 'Dummy', id: `2`, embedded: [{ __typename: 'Embedded', id: `2b` }] },
                    { __typename: 'Dummy', id: `3`, embedded: [{ __typename: 'Embedded', id: `3b` }] },
                ],
            },
        });
    });
});
