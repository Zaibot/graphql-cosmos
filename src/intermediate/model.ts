import { SqlOpParameter } from '../sql/op';

export interface CosmosRequest {
    where: Array<CosmosArgWhere>;
    sort: Array<CosmosArgSort>;
    paging: CosmosArgPaging | undefined;
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

export interface CosmosArgPaging {
    offset: number;
    limit: number;
}
