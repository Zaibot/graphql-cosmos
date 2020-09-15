import { DirectiveLocation, DirectiveNode, getDirectiveValues, GraphQLDirective, GraphQLSchema, GraphQLString } from 'graphql';
import { SchemaDirectiveVisitor } from 'graphql-tools';

export class SortDirective extends SchemaDirectiveVisitor<{ ours?: string }> {
    static getDirectiveDeclaration(directiveName: string, schema: GraphQLSchema) {
        const previousDirective = schema.getDirective(directiveName);
        if (previousDirective) {
            return previousDirective;
        }

        return new GraphQLDirective({
            name: directiveName,
            locations: [DirectiveLocation.FIELD_DEFINITION],
            args: {
                ours: {
                    type: GraphQLString,
                },
            },
        });
    }

    static has(directiveName: string, schema: GraphQLSchema, node: { readonly directives?: readonly DirectiveNode[] | undefined }) {
        const d = node.directives?.map((x) => x.name.value);
        return d?.includes(directiveName);
    }

    static getOurs(directiveName: string, schema: GraphQLSchema, node: { readonly directives?: readonly DirectiveNode[] | undefined }) {
        const directive = SortDirective.getDirectiveDeclaration(directiveName, schema);
        const values = getDirectiveValues(directive, node);
        const raw = values?.ours as string | undefined;
        return raw;
    }

    get argOurs() {
        return this.args.ours as string | undefined;
    }

    visitFieldDefinition() {
        // noop
    }
}
