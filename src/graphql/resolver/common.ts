import { GraphQLCosmosContext, GraphQLCosmosInitRequest, GraphQLCosmosRequest } from '../../configuration';
import { defaultOnInit, defaultOnQuery } from '../../default';
import { CosmosArgSort, CosmosArgWhere, CosmosRequest } from '../../intermediate/model';
import { isSqlOperation, SqlOperationList, SqlOperationScalar, SqlOpParameter } from '../../sql/op';

export const argsToCosmosRequest = (args: Record<string, any>) => {
    const parseWhere = (where: Record<string, unknown>): Array<CosmosArgWhere> => {
        return Object.entries(where).map(([whereField, value]) => {
            const [property, operation = ``] = whereField.split(`_`);
            if (isSqlOperation(operation)) {
                return { property, operation, value: value as SqlOpParameter, parameter: `@${whereField}` };
            } else {
                throw Error(`unknown operation type on field ${whereField}`);
            }
        });
    };

    const parseSort = (sort: Record<string, number>): Array<CosmosArgSort> => {
        return Object.entries(sort)
            .sort((a, b) => a[1] - b[1])
            .map(([sortField, value]) => {
                const [property, direction] = sortField.split(`_`);
                return { property, direction };
            });
    };

    const { where = {}, sort = {}, cursor = undefined as string | undefined } = args;

    const graphquery: CosmosRequest = {
        where: parseWhere(where),
        sort: parseSort(sort),
        cursor,
    };

    return graphquery;
};

export const collectionResolver = async (typename: string, graphquery: CosmosRequest, context: GraphQLCosmosContext, container: string) => {
    const { cosmos } = context.directives;
    const { onBeforeQuery, onQuery = defaultOnQuery, onInit = defaultOnInit } = cosmos;

    //
    // Prepare CosmosDB query
    const init: GraphQLCosmosInitRequest = {
        client: cosmos.client,
        database: cosmos.database,
        container,
        options: {
            continuationToken: graphquery.cursor,
        },
    };
    onInit(graphquery, init);

    //
    // When looking for a single `id` value, attempt to use data loader
    const byId = graphquery.where.find((x) => x.property === `id`);

    const singleExpression = graphquery.where.length === 1;
    if (singleExpression && byId?.operation === SqlOperationScalar.eq && !Array.isArray(byId.value)) {
        const dataloader = context.directives.cosmos.dataloader?.({ database: init.database, container });
        if (dataloader) {
            // Find single entity by id
            return { page: [await dataloader(byId.value)] };
        }
    }

    if (singleExpression && byId?.operation === SqlOperationList.in && Array.isArray(byId.value)) {
        const dataloader = context.directives.cosmos.dataloader?.({ database: init.database, container });
        if (dataloader) {
            // Find multiple entities using id list
            return { page: await Promise.all(byId.value.map(dataloader)) };
        }
    }

    //
    // Notify query about to be requested
    onBeforeQuery?.(init);

    if (!init.query) {
        throw Error(`requires query`);
    }
    if (!init.parameters) {
        throw Error(`requires query parameters`);
    }

    //
    // Send CosmosDB query
    const request: GraphQLCosmosRequest = {
        client: init.client,
        database: init.database,
        container: init.container,
        query: init.query.toSql(),
        parameters: init.parameters,
        options: init.options,
    };

    const response = await onQuery(request);
    const nextCursor = response.continuationToken;
    const page = response.resources.map((item) => ({ __typename: typename, ...item }));
    return { response, nextCursor, page };
};
