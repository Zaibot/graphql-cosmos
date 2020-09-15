import { GraphQLSchema, printSchema, validateSchema } from 'graphql';
import gql from 'graphql-tag';
import { makeExecutableSchema, SchemaDirectiveVisitor } from 'graphql-tools';
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
        name: String! @sort(ours: "test")
    }
`;

describe(`Processed schema`, () => {
    let output: string;
    let dummy: GraphQLSchema;

    beforeEach(() => {
        dummy = makeExecutableSchema({
            typeDefs: [schema.typeDefs, dummyTypeDefs],
            schemaDirectives: schema.schemaDirectives,
        });

        SchemaDirectiveVisitor.visitSchemaDirectives(dummy, {});
        expect(validateSchema(dummy)).toHaveLength(0);

        output = printSchema(dummy, { commentDescriptions: false });
        console.log(output);
    });

    it(`should match expected`, () => {
        expect(normalize(output)).toBe(
            normalize(`
                directive @cosmos(container: String, ours: String, theirs: String) on FIELD_DEFINITION

                directive @where(op: String, ours: String) on FIELD_DEFINITION
            
                directive @sort(ours: String) on FIELD_DEFINITION
            
                type Query {
                    dummies(where: DummyWhere, offset: Int, limit: Int): [Dummy]
                }
            
                type Dummy {
                    id: ID!
                    related(where: RelatedWhere, sort: RelatedSort, offset: Int, limit: Int): [Related]
                }
            
                type Related {
                    id: ID!
                    name: String!
                }
            
                input DummyWhere {
                    id_eq: ID
                }
            
                input RelatedWhere {
                    id_eq: ID
                }
            
                input RelatedSort {
                    name_ASC: Int
                    name_DESC: Int
                }
            `),
        );
    });
});

const normalize = (text: string) =>
    text
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean)
        .join(`\n`);
