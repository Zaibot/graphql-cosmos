import {
    DirectiveLocation,
    getNamedType,
    getNullableType,
    GraphQLDirective,
    GraphQLField,
    GraphQLInt,
    GraphQLInterfaceType,
    GraphQLObjectType,
    GraphQLScalarType,
    GraphQLSchema,
    GraphQLString,
    isListType,
    isObjectType,
    isScalarType,
} from 'graphql';
import { SchemaDirectiveVisitor } from 'graphql-tools';
import { GraphQLCosmosContext, GraphQLCosmosInitRequest, GraphQLCosmosRequest } from './context';
import { createSqlQuery, defaultOnQuery } from './cosmos';
import { addFieldArgument, createOrGetWhereType } from './graphql';

export class CosmosDirective extends SchemaDirectiveVisitor {
    static getDirectiveDeclaration(directiveName: string, schema: GraphQLSchema) {
        const previousDirective = schema.getDirective(directiveName);
        if (previousDirective) {
            return previousDirective;
        }

        return new GraphQLDirective({
            name: directiveName,
            locations: [DirectiveLocation.OBJECT, DirectiveLocation.FIELD_DEFINITION],
            args: {
                container: {
                    type: GraphQLString,
                },
                ours: {
                    type: GraphQLString,
                },
                theirs: {
                    type: GraphQLString,
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
        field: GraphQLField<any, any>,
        _details: {
            objectType: GraphQLObjectType | GraphQLInterfaceType;
        },
    ): GraphQLField<any, any> | void | null {
        const operations = [``, `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte`, `_in`, `_nin`, `_contains`, `_ncontains`];

        const namedType = getNamedType(field.type);
        const manyType = isListType(getNullableType(field.type)) ? field.type : undefined;
        if (isObjectType(namedType)) {
            const ours = this.argOurs;
            const theirs = this.argTheirs;
            const container = this.argContainer;
            if (!container) throw Error(`requires container argument`);

            //
            // Get scalar fields
            const filterableScalar = Object.entries(namedType.getFields())
                .filter(([_, f]) => isScalarType(getNullableType(f.type)))
                .map(([name, tmpfield]) => ({ name, tmpfield, scalar: getNullableType(tmpfield.type) as GraphQLScalarType }));
            const sortableScalar = Object.entries(namedType.getFields())
                .filter(([_, f]) => isScalarType(getNullableType(f.type)))
                .map(([name, tmpfield]) => ({ name, tmpfield, scalar: getNullableType(tmpfield.type) as GraphQLScalarType }));

            //
            // Replace resolver
            if (manyType) {
                field.resolve = async (source, args, context: GraphQLCosmosContext, _info) => {
                    if (ours || theirs) {
                        const ourValueOrList = source[ours ?? 'id'];
                        if (Array.isArray(ourValueOrList)) {
                            const whereOurs = `${theirs ?? 'id'}_in`;
                            if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`);
                            const where = { ...args.where, [whereOurs]: ourValueOrList };
                            return await this.collectionResolver(namedType, { ...args, where }, context, container);
                        } else {
                            const whereOurs = `${theirs ?? 'id'}_eq`;
                            if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`);
                            const where = { ...args.where, [whereOurs]: ourValueOrList };
                            return await this.collectionResolver(namedType, { ...args, where }, context, container);
                        }
                    } else {
                        return await this.collectionResolver(namedType, args, context, container);
                    }
                };
            } else {
                field.resolve = async (source, args, context: GraphQLCosmosContext, _info) => {
                    if (ours || theirs) {
                        const ourValueOrList = source[ours ?? 'id'];
                        const whereOurs = `${theirs ?? 'id'}_eq`;
                        if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`);
                        const where = { ...args.where, [whereOurs]: ourValueOrList };
                        const result = await this.collectionResolver(namedType, { ...args, where }, context, container);
                        return result?.[0];
                    } else {
                        const result = await this.collectionResolver(namedType, args, context, container);
                        return result?.[0];
                    }
                };
            }

            //
            // Generate where type holder filter input
            const whereFields = Object.fromEntries(
                filterableScalar.flatMap((field) =>
                    operations
                        .map((operation) => ({ ...field, operation }))
                        .map(({ name, operation, scalar }) => [`${name}${operation}`, { type: scalar, extensions: { __operation: operation } }]),
                ),
            );
            const filterType = createOrGetWhereType(`${namedType.name}Where`, whereFields, this.schema);
            addFieldArgument(field, `where`, filterType);

            //
            // Generate where type holder filter input
            const sortFields = Object.fromEntries(
                sortableScalar.flatMap(({ name }) => [
                    [`${name}_ASC`, { type: GraphQLInt }],
                    [`${name}_DESC`, { type: GraphQLInt }],
                ]),
            );
            const sortType = createOrGetWhereType(`${namedType.name}Sort`, sortFields, this.schema);
            addFieldArgument(field, `sort`, sortType);

            addFieldArgument(field, `offset`, GraphQLInt);
            addFieldArgument(field, `limit`, GraphQLInt);
        }
        return field;
    }

    private async collectionResolver(type: GraphQLObjectType<any, any>, args: Record<string, any>, context: GraphQLCosmosContext, container: string) {
        const { where = {}, sort = {}, offset = 0, limit = 0 } = args;
        const { cosmos } = context.directives;
        const { onBeforeQuery, onQuery = defaultOnQuery } = cosmos;

        if (offset > 0 && limit <= 0) {
            throw Error(`where filters $limit must be set when $offset has been defined`);
        }

        //
        // Parse GraphQL where fields
        const whereInputExpressions = Object.entries(where).map(([whereField, value]) => {
            const [property, operation = ``] = whereField.split(`_`);
            return { property, operation, value, parameter: `@${whereField}` };
        });

        //
        // Parse GraphQL sort fields
        const sortInputExpressions = Object.entries(sort)
            .map(([k, v]) => [k, Number(v)] as [string, number])
            .sort((a, b) => a[1] - b[1])
            .map(([sortField, value]) => {
                const [property, direction] = sortField.split(`_`);
                return { property, direction };
            });

        //
        // Construct query
        const { sql, parameters } = createSqlQuery(whereInputExpressions, sortInputExpressions, offset || limit ? { offset, limit } : undefined);

        //
        // Prepare CosmosDB query
        const init: GraphQLCosmosInitRequest = {
            client: cosmos.client,
            database: cosmos.database,
            container,
            query: sql,
            parameters,
        };

        //
        // When looking for a single `id` value, attempt to use data loader
        const byId = whereInputExpressions.find((x) => x.property === `id`);

        const singleExpression = whereInputExpressions.length === 1;
        if (singleExpression && (byId?.operation === `` || byId?.operation === `eq`)) {
            const dataloader = context.directives.cosmos.dataloader?.({ database: init.database, container });
            if (dataloader) {
                // Find single entity by id
                return [await dataloader(byId.value)];
            }
        }

        if (singleExpression && (byId?.operation === `` || byId?.operation === `in`)) {
            const dataloader = context.directives.cosmos.dataloader?.({ database: init.database, container });
            if (dataloader) {
                // Find multiple entities using id list
                return await Promise.all((byId.value as Array<any>).map(dataloader));
            }
        }

        //
        // Notify query about to be requested
        onBeforeQuery?.(init);

        //
        // Send CosmosDB query
        const request: GraphQLCosmosRequest = {
            client: init.client,
            database: init.database,
            container: init.container,
            query: init.query.toSql(),
            parameters: init.parameters,
        };
        const response = await onQuery(request);

        return response.resources.map((x) => ({ __typename: type.name, ...x }));
    }

    visitObject(object: GraphQLObjectType) {
        // console.log(`visitObject(${object.name})`, this.args);
    }
}
