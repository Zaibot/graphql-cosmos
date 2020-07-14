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
        related: Related @cosmos(container: "Relations", ours: "relatedId")
    }

    type Related {
        id: ID!
    }
`;

const onCosmosQuery = async ({ container, query, parameters }: GraphQLCosmosRequest): Promise<any> => {
    const queryResult: Record<string, Record<string, unknown[]>> = {
        Dummies: {
            'SELECT * FROM c ORDER BY c.id': [
                { id: `1`, relatedId: `1b` },
                { id: `2`, relatedId: `2b` },
                { id: `3`, relatedId: `3b` },
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
                cosmos: CosmosDirective,
            } as any,
        });

        dataloader = [];

        expect(validateSchema(dummy)).toHaveLength(0);
    });

    it(`should be retrieve all items`, async () => {
        const query = parse(`query { dummies { related { id } } } `);
        const result = await execute(dummy, query, undefined, context);

        expect(validate(dummy, query)).toHaveLength(0);
        expect(result).toEqual({
            data: {
                dummies: [{ related: { id: `1b` } }, { related: { id: `2b` } }, { related: { id: `3b` } }],
            },
        });
        expect(dataloader).toEqual([`1b`, `2b`, `3b`]);
    });
});
