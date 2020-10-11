import { GraphQLResolveInfo } from 'graphql/type';
import { SqlOpParameter } from '../sql/op';

export interface CosmosRequest {
  type: 'array' | 'count';
  resolverDescription: string;
  graphqlInfo: GraphQLResolveInfo;
  columns: Array<string>;
  where: Array<CosmosArgWhere>;
  sort: Array<CosmosArgSort>;
  cursor: string | undefined;
}

export interface CosmosArgWhere {
  property: string;
  operation: string;
  value: SqlOpParameter;
  parameter: string;
}

export interface CosmosArgSort {
  property: string;
  direction: string;
}
