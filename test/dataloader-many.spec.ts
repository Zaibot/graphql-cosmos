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
        related: [Related] @cosmos(container: "Relations", ours: "relatedIds")
    }

    type Related {
        id: ID! @where(op: "eq")
    }
`;

const onCosmosQuery = async ({ container, query, parameters }: GraphQLCosmosRequest): Promise<any> => {
    const queryResult: Record<string, Record<string, unknown[]>> = {
        Dummies: {
            'SELECT * FROM c ORDER BY c.id': [
                { id: `1`, relatedIds: [`1a`, `1b`] },
                { id: `2`, relatedIds: [`2a`, `2b`] },
                { id: `3`, relatedIds: [`3a`, `3b`] },
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

describe(`Data Loader`, () => {
    let context: GraphQLCosmosContext;
    let dummy: GraphQLSchema;
    let dataloader: string[];

    beforeEach(() => {
        context = {
            directives: {
                cosmos: {
                    client: null as any,
                    database: null as any,
                    dataloader({ container }) {
                        if (container === `Relations`) {
                            return (id: any) => {
                                dataloader.push(id);
                                return { id };
                            };
                        } else {
                            return null;
                        }
                    },
                    onQuery: onCosmosQuery,
                },
            },
        };

        dummy = makeExecutableSchema({
            typeDefs: [schema.typeDefs, dummyTypeDefs],
            schemaDirectives: {
                ...schema.schemaDirectives,
            },
        });

        dataloader = [];

        expect(validateSchema(dummy)).toHaveLength(0);
    });

    it(`should be retrieve all items`, async () => {
        const query = parse(`query { dummies { page { related { page { id } } } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: {
                    page: [
                        {
                            related: { page: [{ id: `1a` }, { id: `1b` }] },
                        },
                        {
                            related: { page: [{ id: `2a` }, { id: `2b` }] },
                        },
                        {
                            related: { page: [{ id: `3a` }, { id: `3b` }] },
                        },
                    ],
                },
            },
        });
        expect(dataloader).toEqual([`1a`, `1b`, `2a`, `2b`, `3a`, `3b`]);
    });
});
