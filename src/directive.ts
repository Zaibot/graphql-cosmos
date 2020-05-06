import { DirectiveLocation, getNullableType, GraphQLDirective, GraphQLField, GraphQLInterfaceType, GraphQLObjectType, GraphQLScalarType, GraphQLSchema, GraphQLString, isListType, isObjectType, isScalarType } from 'graphql';
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
        const operations = [``, `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte`, `_in`, `_nin`, `_contain`, `_ncontain`];

        if (isListType(field.type)) {
            const otype = field.type.ofType;
            if (isObjectType(otype)) {
                const ours = this.argOurs;
                const theirs = this.argTheirs;
                const container = this.argContainer;
                if (!container) throw Error(`requires container argument`);

                //
                // Get scalar fields
                const filterable = Object.entries(otype.getFields())
                    .filter(([_, f]) => isScalarType(getNullableType(f.type)))
                    .map(([name, tmpfield]) => ({ name, tmpfield, scalar: getNullableType(tmpfield.type) as GraphQLScalarType }));

                //
                // Replace resolver
                field.resolve = async (source, args, context: GraphQLCosmosContext, info) => {
                    if (ours || theirs) {
                        const ourValueOrList = source[ours ?? 'id'];
                        if (Array.isArray(ourValueOrList)) {
                            const whereOurs = `${theirs ?? 'id'}_in`;
                            if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`);
                            return await this.collectionResolver(otype, { where: { ...args, [whereOurs]: ourValueOrList } }, context, container);
                        } else {
                            const whereOurs = `${theirs ?? 'id'}_eq`;
                            if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`);
                            return await this.collectionResolver(otype, { where: { ...args, [whereOurs]: ourValueOrList } }, context, container);
                        }
                    } else {
                        return await this.collectionResolver(otype, args, context, container);
                    }
                };

                //
                // Generate where type holder filter input
                const whereFields = Object.fromEntries(
                    filterable.flatMap((field) =>
                        operations
                            .map((operation) => ({ ...field, operation }))
                            .map(({ name, operation, scalar }) => [`${name}${operation}`, { type: scalar, extensions: { __operation: operation } }]),
                    ),
                );
                const filterType = createOrGetWhereType(`${field.type.ofType.name}Where`, whereFields, this.schema);

                addFieldArgument(field, `where`, filterType);
            }
        }
        return field;
    }

    private async collectionResolver(type: GraphQLObjectType<any, any>, args: Record<string, any>, context: GraphQLCosmosContext, container: string) {
        const { where = {} } = args;
        const { cosmos } = context.directives;
        const { onBeforeQuery, onQuery = defaultOnQuery } = cosmos;

        //
        // Parse GraphQL where fields
        const whereInputExpressions = Object.entries(where).map(([whereField, value]) => {
            const [property, operation = ``] = whereField.split(`_`);
            return { property, operation, value, parameter: `@${whereField}` };
        });

        //
        // Construct query
        const { sql, parameters } = createSqlQuery(whereInputExpressions);

        //
        // Prepare CosmosDB query
        const init: GraphQLCosmosInitRequest = {
            client: cosmos.client,
            database: cosmos.database,
            container,
            query: sql,
            parameters,
        };
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
