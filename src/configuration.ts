import { CosmosClient, FeedResponse, FeedOptions } from '@azure/cosmos';
import { SqlBuilder } from './sql/builder';
import { SqlOpScalar } from './sql/op';
import { CosmosRequest } from './intermediate/model';

export interface GraphQLCosmosContext {
    directives: GraphQLDirectivesContext;
}

export interface GraphQLDirectivesContext {
    cosmos: {
        database: string;
        client: CosmosClient;
        dataloader?: GraphQLCosmosDataLoaderResolver;
        /** default: defaultOnInit */
        onInit?: (request: CosmosRequest, init: GraphQLCosmosInitRequest) => void;
        onBeforeQuery?: (request: GraphQLCosmosInitRequest) => void;
        /** default: defaultOnQuery */
        onQuery?: (request: GraphQLCosmosRequest) => Promise<FeedResponse<any>>;
    };
}

export type GraphQLCosmosDataLoaderResolver = (args: { database: string; container: string }) => null | ((id: SqlOpScalar) => unknown | Promise<unknown>);

export interface GraphQLCosmosInitRequest {
    client: CosmosClient;
    database: string;
    container: string;
    query?: SqlBuilder;
    parameters?: Array<{ name: string; value: any }>;
    options?: FeedOptions;
}

export interface GraphQLCosmosRequest {
    client: CosmosClient;
    database: string;
    container: string;
    query: string;
    parameters: Array<{ name: string; value: any }>;
    options?: FeedOptions;
}
