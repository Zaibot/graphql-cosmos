import { CosmosClient, FeedResponse, FeedOptions } from "@azure/cosmos";
import { SqlBuilder } from "./sql/builder";
import { SqlOpScalar } from "./sql/op";
import { CosmosRequest } from "./intermediate/model";

export interface GraphQLCosmosContext {
  directives: GraphQLDirectivesContext;
}

export type CosmosQueryHandler = (
  request: GraphQLCosmosRequest
) => Promise<FeedResponse<any>>;

export interface GraphQLDirectivesContext {
  cosmos: {
    database: string;
    client: CosmosClient;
    dataloader?: GraphQLCosmosDataLoaderResolver;
    /** default: defaultOnInit */
    onInit?: (request: CosmosRequest, init: GraphQLCosmosInitRequest) => void;
    onBeforeQuery?: (request: GraphQLCosmosInitRequest) => void;
    /** default: defaultOnQuery */
    onQuery?: CosmosQueryHandler;
  };
}

export interface DataLoaderSpec {
  id: SqlOpScalar;
  columns: string[];
}
export type GraphQLCosmosDataLoaderResolver = (args: {
  database: string;
  container: string;
}) => null | ((spec: DataLoaderSpec) => unknown | Promise<unknown>);

export interface GraphQLCosmosInitRequest {
  client: CosmosClient;
  request: CosmosRequest;
  database: string;
  container: string;
  query?: SqlBuilder;
  parameters?: Array<{ name: string; value: any }>;
  options?: FeedOptions;
}

export interface GraphQLCosmosRequest {
  init?: GraphQLCosmosInitRequest;
  client: CosmosClient;
  database: string;
  container: string;
  query: string;
  parameters: Array<{ name: string; value: any }>;
  options?: FeedOptions;
}
