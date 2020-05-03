import {
    DirectiveLocation,
    getNullableType,
    GraphQLDirective,
    GraphQLField,
    GraphQLFieldResolver,
    GraphQLInputFieldConfig,
    GraphQLInputObjectType,
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
import { GraphQLCosmosContext } from './context';

export class CosmosDirective extends SchemaDirectiveVisitor {
    static getDirectiveDeclaration(directiveName: string, schema: GraphQLSchema) {
        console.log('Get Directive: ', directiveName);
        const previousDirective = schema.getDirective(directiveName);
        if (previousDirective) {
            return previousDirective;
        }

        return new GraphQLDirective({
            name: directiveName,
            locations: [DirectiveLocation.FIELD_DEFINITION],
            args: {
                key: {
                    type: GraphQLString,
                },
            },
        });
    }

    get argContainer() {
        return this.args.container as string | undefined;
    }

    get argField() {
        return this.args.field as string | undefined;
    }

    visitFieldDefinition(
        field: GraphQLField<any, any>,
        details: {
            objectType: GraphQLObjectType | GraphQLInterfaceType;
        },
    ): GraphQLField<any, any> | void | null {
        console.log(`visitFieldDefinition(${details.objectType.name}.${field.name})`, this.args);

        const operations = [``, `_eq`, `_neq`, `_gt`, `_gte`, `_lt`, `_lte`, `_in`, `_nin`, `_contain`, `_ncontain`];

        if (isListType(field.type)) {
            if (isObjectType(field.type.ofType)) {
                const filterable = Object.entries(field.type.ofType.getFields())
                    .filter(([_, f]) => isScalarType(getNullableType(f.type)))
                    .map(([name, tmpfield]) => ({ name, tmpfield, scalar: getNullableType(tmpfield.type) as GraphQLScalarType }));

                const resolver: GraphQLFieldResolver<Record<string, any>, GraphQLCosmosContext> = async (
                    _,
                    { where = {} },
                    {
                        directives: {
                            cosmos: { client },
                        },
                    }: GraphQLCosmosContext,
                    info,
                ) => {
                    const params = Object.entries(where).map(([name, value]) => ({
                        name: name.split(`_`)[0] ?? ``,
                        operation: name.split(`_`)[1] ?? ``,
                        value,
                    }));

                    console.log({ params });

                    const r = `c`;

                    const paramsq = params
                        .map((x) => {
                            const p = `@${x.name}_${x.operation}`;
                            const todo: Record<string, string> = {
                                '': `${r}.${x.name} = ${p}`,
                                eq: `${r}.${x.name} = ${p}`,
                                neq: `${r}.${x.name} != ${p}`,
                                gt: `${r}.${x.name} > ${p}`,
                                gte: `${r}.${x.name} >= ${p}`,
                                lt: `${r}.${x.name} < ${p}`,
                                lte: `${r}.${x.name} <= ${p}`,
                                // HACK
                                in: `CONTAINS(${p}, ${r}.${x.name})`,
                                nin: `NOT CONTAINS(${p}, ${r}.${x.name})`,
                                contains: `CONTAINS(${r}.${x.name}, ${p})`,
                                ncontains: `NOT CONTAINS(${r}.${x.name}, ${p})`,
                            };

                            const s = todo[x.operation];
                            console.log({ s, v: x.value, p });
                            if (s) {
                                return { s, v: x.value, p };
                            }
                        })
                        .filter((x) => !!x);

                    const q = `SELECT * FROM ${r} WHERE ${paramsq
                        .map((x) => x?.s)
                        .filter(Boolean)
                        .join(` AND `)}`;

                    console.log({ q, paramsq });

                    const { resources } = await client
                        .database(`ToDoList`)
                        .container(this.argContainer!)
                        .items.query({
                            query: q,
                            parameters: paramsq.map((x) => ({ name: x!.p!, value: x!.v! as any })),
                        })
                        .fetchAll();

                    return resources;
                };

                field.resolve = resolver;

                const whereFields: Array<[string, GraphQLInputFieldConfig]> = filterable
                    .flatMap((x) => operations.map((operation) => ({ ...x, operation })))
                    .map(({ name, operation, scalar }) => [`${name}${operation}`, { type: scalar, extensions: { __operation: operation } }]);

                const whereFieldsObj = Object.fromEntries(whereFields);

                const filterType = new GraphQLInputObjectType({
                    name: `${field.type.ofType.name}Where`,
                    description: undefined,
                    extensions: undefined,
                    fields: whereFieldsObj,
                    astNode: undefined,
                    extensionASTNodes: undefined,
                });

                field.args.push({
                    name: `where`,
                    type: filterType,
                    astNode: undefined,
                    extensions: undefined,
                    description: undefined,
                    defaultValue: undefined,
                });

                // HACK
                this.schema.getTypeMap()[filterType.name] = filterType;
            }
        }
        return field;
    }

    visitObject(object: GraphQLObjectType) {
        console.log({ object });
    }
}
