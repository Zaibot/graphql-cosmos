import { CosmosClient, FeedResponse } from '@azure/cosmos';
import { SqlBuilder } from './sql';

export interface GraphQLCosmosContext {
    directives: GraphQLDirectivesContext;
}

export interface GraphQLDirectivesContext {
    cosmos: {
        database: string;
        client: CosmosClient;
        onBeforeQuery?: (request: GraphQLCosmosInitRequest) => void;
        onQuery?: (request: GraphQLCosmosRequest) => Promise<FeedResponse<any>>;
    };
}

export interface GraphQLCosmosInitRequest {
    client: CosmosClient;
    database: string;
    container: string;
    query: SqlBuilder;
    parameters: Array<{ name: string; value: any }>;
}

export interface GraphQLCosmosRequest {
    client: CosmosClient;
    database: string;
    container: string;
    query: string;
    parameters: Array<{ name: string; value: any }>;
}
