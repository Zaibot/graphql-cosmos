import * as GraphQL from "graphql";
import { GraphQLCosmosContext } from "../../configuration";

export const resolveWithCosmosSource = (
  container: string,
  columnId: string,
  requiresColumn: string,
  resolver: GraphQL.GraphQLFieldResolver<any, any>
): GraphQL.GraphQLFieldResolver<any, GraphQLCosmosContext> => {
  return async (source, args, context, info) => {
    if (!source) throw Error(`requires a source`);
    if (typeof source === `object` && requiresColumn in source) {
      // Information already available
      return resolver(source, args, context, info);
    } else {
      // Fetch record from cosmos with the field we require
      const dataloader = context.directives.cosmos.dataloader;
      const database = context.directives.cosmos.database;
      const cosmosSource: any = await dataloader?.({ database, container })?.({
        id: source[columnId],
        columns: [requiresColumn],
      });
      const combinedSource = { ...source, ...cosmosSource };
      return resolver(combinedSource, args, context, info);
    }
  };
};
