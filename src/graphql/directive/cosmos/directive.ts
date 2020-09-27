import * as GraphQL from 'graphql';
import {
    DirectiveLocation,
    DirectiveNode,
    getDirectiveValues,
    getNamedType,
    getNullableType,
    GraphQLSchema,
    isListType,
    isObjectType,
    isScalarType,
} from 'graphql';
import { SchemaDirectiveVisitor } from 'graphql-tools';
import { DEFAULT_ID } from '../../../constants';
import { addFieldArgument, createOrGetPageType } from '../../internal/schema';
import { getCosmosReferenceContainer } from '../../reference';
import { SortDirective } from '../sort/directive';
import { inputSort } from '../sort/input';
import { WhereDirective } from '../where/directive';
import { inputWhere } from '../where/input';
import { findOwnerContainer, resolveManyOurs, resolveManyTheirs, resolveOneOurs, resolveOneTheirs, resolveRootQuery, resolveSourceField } from './resolvers';

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

    static getContainer(directiveName: string, schema: GraphQLSchema, node: { readonly directives?: readonly DirectiveNode[] | undefined }) {
        const directive = WhereDirective.getDirectiveDeclaration(directiveName, schema);
        const values = getDirectiveValues(directive, node);
        const raw = values?.container as string | undefined;
        return raw;
    }
    static getOurs(directiveName: string, schema: GraphQLSchema, node: { readonly directives?: readonly DirectiveNode[] | undefined }) {
        const directive = WhereDirective.getDirectiveDeclaration(directiveName, schema);
        const values = getDirectiveValues(directive, node);
        const raw = values?.orus as string | undefined;
        return raw;
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
        fieldType: GraphQL.GraphQLField<any, any>,
        details: {
            objectType: GraphQL.GraphQLObjectType | GraphQL.GraphQLInterfaceType;
        },
    ): GraphQL.GraphQLField<any, any> | void | null {
        const directiveNameCosmos = `cosmos`;
        const directiveNameWhere = `where`;
        const directiveNameSort = `sort`;

        const ours = this.argOurs;
        const theirs = this.argTheirs;
        const container = this.argContainer;

        //
        // Snapshot of which type.field is stored in a Cosmos container
        const typeFieldToContainerValues = Object.values(this.schema.getTypeMap())
            .filter((x): x is GraphQL.GraphQLObjectType => isObjectType(x))
            .map((owner): [string, Array<[string, string]>] => [
                owner.name,
                Object.values(owner.getFields())
                    .map((ownerField) => [ownerField.name, CosmosDirective.getContainer(directiveNameCosmos, this.schema, ownerField.astNode ?? {})])
                    .filter((x): x is [string, string] => !!x[0] && !!x[1]),
            ]);
        const typeFieldToContainer = new Map(typeFieldToContainerValues.map(([name, f]) => [name, new Map(f)]));

        if (container) {
            const objectType = details.objectType;
            const returnType = fieldType.type;
            const returnTypeCore = getNamedType(returnType);
            const returnTypeMany = isListType(getNullableType(returnType)) ? returnType : undefined;
            if (isObjectType(returnTypeCore)) {
                const filterableScalar = Object.entries(returnTypeCore.getFields())
                    .map(([name, field]) => ({ name, field, scalar: getNullableType(field.type) as GraphQL.GraphQLScalarType }))
                    .filter(({ field }) => isScalarType(getNullableType(field.type)))
                    .map(({ field, name, scalar }) => ({
                        name,
                        scalar,
                        operations: WhereDirective.getOp(directiveNameWhere, this.schema, field.astNode!) ?? [],
                    }))
                    .filter((x) => x.operations.length > 0);
                if (filterableScalar.length > 0) {
                    const filterType = inputWhere(returnTypeCore.name, filterableScalar, this.schema);
                    addFieldArgument(fieldType, `where`, filterType);
                }

                const sortableScalar = Object.entries(returnTypeCore.getFields())
                    .map(([name, field]) => ({ name, field, scalar: getNullableType(returnType) as GraphQL.GraphQLScalarType }))
                    .filter(({ field }) => isScalarType(getNullableType(field.type)))
                    .filter(({ field }) => SortDirective.has(directiveNameSort, field.astNode ?? {}));
                if (sortableScalar.length > 0) {
                    const sortType = inputSort(returnTypeCore.name, sortableScalar, this.schema);
                    addFieldArgument(fieldType, `sort`, sortType);
                }

                //
                // Pagination
                if (returnTypeMany) {
                    addFieldArgument(fieldType, `cursor`, GraphQL.GraphQLString);
                    fieldType.type = new GraphQL.GraphQLNonNull(wrapOutputWithPagination(fieldType.type, this.schema));
                }

                //
                // Override resolvers per relation type
                if (returnTypeMany && theirs) {
                    // console.log(`${objectType.name}.${fieldType.name}: resolveManyTheirs(${theirs})`);
                    fieldType.resolve = resolveManyTheirs(container, ours, theirs, fieldType);
                } else if (returnTypeMany && ours) {
                    // console.log(`${objectType.name}.${fieldType.name}: resolveManyOurs(${ours})`);
                    fieldType.resolve = resolveManyOurs(typeFieldToContainer, container, ours, theirs, fieldType);
                } else if (returnTypeMany) {
                    // console.log(`${objectType.name}.${fieldType.name}: resolveRootQuery`);
                    fieldType.resolve = resolveRootQuery(container, fieldType);
                } else if (ours) {
                    // console.log(`${objectType.name}.${fieldType.name}: resolveOneOurs(${ours})`);
                    fieldType.resolve = resolveOneOurs(typeFieldToContainer, ours, container, fieldType);
                } else if (theirs) {
                    // console.log(`${objectType.name}.${fieldType.name}: resolveOneTheirs(${theirs})`);
                    fieldType.resolve = resolveOneTheirs(container, ours, fieldType);
                }

                //
                // Fields should be resolved when unavailable in source of a request
                if (returnTypeCore) {
                    // Overriding without knowing the context: here container is embedded in the resolver - maybe container can be a property of a reference?
                    for (const [fieldName, field] of Object.entries(returnTypeCore.getFields())) {
                        if (fieldName === DEFAULT_ID) {
                            field.resolve ??= GraphQL.defaultFieldResolver;
                        } else {
                            const ours = CosmosDirective.getOurs(`cosmos`, this.schema, field.astNode ?? {});
                            field.resolve ??= resolveSourceField(container, DEFAULT_ID, ours ?? field.name, field.resolve ?? GraphQL.defaultFieldResolver);
                        }
                    }
                }
            }
        } else if (ours) {
            // Overriding without knowing the context: here container is embedded in the resolver - maybe container can be a property of a reference?
            const old = fieldType.resolve;
            const container = findOwnerContainer(typeFieldToContainer);
            fieldType.resolve = (s, a, c, i) => {
                const objectContainer = getCosmosReferenceContainer(s) ?? container(i.path) ?? uhuh();
                return resolveSourceField(objectContainer, DEFAULT_ID, ours ?? fieldType.name, old ?? GraphQL.defaultFieldResolver)(s, a, c, i);
            };
        }

        return fieldType;
    }
}

const uhuh = () => {
    throw Error(`uhuh`);
};

const wrapOutputWithPagination = (type: GraphQL.GraphQLOutputType, schema: GraphQL.GraphQLSchema) => {
    return createOrGetPageType(
        `${getNamedType(type).name}Page`,
        {
            nextCursor: { type: GraphQL.GraphQLString },
            page: { type },
        },
        schema,
    );
};