import { CosmosClient, FeedResponse } from '@azure/cosmos';

export interface GraphQLCosmosContext {
    directives: GraphQLDirectivesContext;
}

export interface GraphQLDirectivesContext {
    cosmos: {
        database: string;
        client: CosmosClient;
        onBeforeQuery?: (request: GraphQLCosmosRequest) => void;
        onQuery?: (request: GraphQLCosmosRequest) => Promise<FeedResponse<any>>;
    };
}

export interface GraphQLCosmosRequest {
    client: CosmosClient;
    database: string;
    container: string;
    query: string;
    parameters: Array<{ name: string; value: any }>;
}
