import { GraphQLInputFieldConfig, GraphQLSchema, GraphQLInputType, GraphQLInputObjectType, GraphQLField } from 'graphql';

export const createOrGetWhereType = (name: string, properties: Record<string, GraphQLInputFieldConfig>, schema: GraphQLSchema) => {
    if (schema.getTypeMap()[name]) {
        return schema.getTypeMap()[name] as GraphQLInputType;
    }

    const filterType = new GraphQLInputObjectType({
        name,
        description: undefined,
        extensions: undefined,
        fields: properties,
        astNode: undefined,
        extensionASTNodes: undefined,
    });

    // HACK
    schema.getTypeMap()[name] = filterType;

    return filterType;
};

export const addFieldArgument = (field: GraphQLField<any, any, any>, name: string, type: GraphQLInputType) => {
    field.args.push({
        name,
        type,
        astNode: undefined,
        extensions: undefined,
        description: undefined,
        defaultValue: undefined,
    });
};
