import { GraphQLCosmosInitRequest, GraphQLCosmosRequest } from './configuration';
import { CosmosRequest } from './intermediate/model';
import { convertToSql } from './sql';

export const defaultOnQuery = ({ client, database, container, query, parameters, options }: GraphQLCosmosRequest) =>
    client.database(database).container(container).items.query({ query, parameters }, options).fetchAll();

export const defaultOnInit = (request: CosmosRequest, init: GraphQLCosmosInitRequest) => {
    const sql = convertToSql(request);
    init.query = sql.sql;
    init.parameters = sql.parameters;
};
