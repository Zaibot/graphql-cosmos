import { CosmosClient } from '@azure/cosmos';

export interface GraphQLCosmosContext {
    directives: GraphQLDirectivesContext;
}

export interface GraphQLDirectivesContext {
    cosmos: {
        client: CosmosClient;
    };
}
