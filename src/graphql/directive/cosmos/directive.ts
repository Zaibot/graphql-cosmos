import * as GraphQL from 'graphql';
import { DirectiveLocation, getNamedType, getNullableType, isListType, isObjectType, isScalarType } from 'graphql';
import { SchemaDirectiveVisitor } from 'graphql-tools';
import { GraphQLCosmosContext } from '../../../configuration';
import { addFieldArgument, createOrGetPageType } from '../../internal/schema';
import { resolverCollection } from '../../resolver/all';
import { resolverOne } from '../../resolver/first';
import { SortDirective } from '../sort/directive';
import { inputSort } from '../sort/input';
import { WhereDirective } from '../where/directive';
import { inputWhere } from '../where/input';

export class CosmosDirective extends SchemaDirectiveVisitor {
    static getDirectiveDeclaration(directiveName: string, schema: GraphQL.GraphQLSchema) {
        const previousDirective = schema.getDirective(directiveName);
        if (previousDirective) {
            return previousDirective;
        }

        return new GraphQL.GraphQLDirective({
            name: directiveName,
            locations: [DirectiveLocation.FIELD_DEFINITION],
            args: {
                container: {
                    type: GraphQL.GraphQLString,
                },
                ours: {
                    type: GraphQL.GraphQLString,
                },
                theirs: {
                    type: GraphQL.GraphQLString,
                },
            },
        });
    }

    get argContainer() {
        return this.args.container as string | undefined;
    }

    get argOurs() {
        return this.args.ours as string | undefined;
    }

    get argTheirs() {
        return this.args.theirs as string | undefined;
    }

    visitFieldDefinition(
        field: GraphQL.GraphQLField<any, any>,
        _details: {
            objectType: GraphQL.GraphQLObjectType | GraphQL.GraphQLInterfaceType;
        },
    ): GraphQL.GraphQLField<any, any> | void | null {
        const directiveNameWhere = `where`;
        const directiveNameSort = `sort`;

        const type = field.type;
        const namedType = getNamedType(type);
        const manyType = isListType(getNullableType(type)) ? type : undefined;
        if (isObjectType(namedType)) {
            const ours = this.argOurs;
            const theirs = this.argTheirs;
            const container = this.argContainer;
            if (!container) throw Error(`requires container argument`);

            const filterableScalar = Object.entries(namedType.getFields())
                .map(([name, field]) => ({ name, field, scalar: getNullableType(field.type) as GraphQL.GraphQLScalarType }))
                .filter(({ field }) => isScalarType(getNullableType(field.type)));
            const filterType = inputWhere(
                namedType.name,
                filterableScalar.map(({ field, name, scalar }) => ({
                    name,
                    scalar,
                    operations: WhereDirective.getOp(directiveNameWhere, this.schema, field.astNode!) ?? [],
                })),
                this.schema,
            );

            const sortableScalar = Object.entries(namedType.getFields())
                .map(([name, field]) => ({ name, field, scalar: getNullableType(type) as GraphQL.GraphQLScalarType }))
                .filter(({ field }) => isScalarType(getNullableType(field.type)))
                .filter(({ field }) => SortDirective.has(directiveNameSort, this.schema, field.astNode!));
            const sortType = inputSort(namedType.name, sortableScalar, this.schema);

            if (filterableScalar.length > 0) {
                addFieldArgument(field, `where`, filterType);
            }
            if (sortableScalar.length > 0) {
                addFieldArgument(field, `sort`, sortType);
            }
            addFieldArgument(field, `cursor`, GraphQL.GraphQLString);

            //
            // Replace resolver
            if (manyType) {
                field.type = createOrGetPageType(
                    `${namedType.name}Page`,
                    {
                        nextCursor: { type: GraphQL.GraphQLString },
                        page: { type: type },
                    },
                    this.schema,
                );

                field.resolve = async (source, args, context: GraphQLCosmosContext, _info) => {
                    return resolverCollection(namedType.name, container, ours, theirs, source, args, context, _info);
                };
            } else {
                field.resolve = async (source, args, context: GraphQLCosmosContext, _info) => {
                    return resolverOne(namedType.name, container, ours, theirs, source, args, context, _info);
                };
            }
        }
        return field;
    }
}
