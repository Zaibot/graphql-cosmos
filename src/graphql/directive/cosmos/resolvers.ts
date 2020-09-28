import * as GraphQL from "graphql";
import { GraphQLCosmosContext } from "../../../configuration";
import { DEFAULT_ID } from "../../../constants";
import {
  getCosmosReferenceContainer,
  toCosmosReference,
} from "../../reference";
import { argsToCosmosRequest, cosmosResolve } from "../../resolver/common";
import { resolveWithCosmosSource } from "../../resolver/resolveWithCosmosSource";

export const resolveRootQuery = (
  container: string,
  fieldType: GraphQL.GraphQLField<any, any>
): GraphQL.GraphQLFieldResolver<any, any> => (_s, a, c, _i) => {
  const returnTypeCore = GraphQL.getNamedType(fieldType.type);
  const graphquery = argsToCosmosRequest([DEFAULT_ID], a);
  const result = cosmosResolve(returnTypeCore.name, graphquery, c, container);
  return result;
};

export const resolveSourceField = resolveWithCosmosSource;

export const resolveManyOurs = (
  typeFieldToContainer: Map<string, Map<string, string>>,
  container: string,
  ours: string | undefined,
  theirs: string | undefined,
  fieldType: GraphQL.GraphQLField<any, any>
): GraphQL.GraphQLFieldResolver<any, any> => (s, a, c, i) => {
  const objectContainer =
    getCosmosReferenceContainer(s) ??
    findOwnerContainer(typeFieldToContainer)(i.path);
  const returnTypeCore = GraphQL.getNamedType(fieldType.type);
  return resolveWithCosmosSource(
    objectContainer,
    DEFAULT_ID,
    ours ?? fieldType.name,
    async (source, args, context: GraphQLCosmosContext, _info) => {
      const list = source[ours ?? fieldType.name];
      if (Array.isArray(list) && list.length > 0) {
        const whereOurs = `${theirs ?? DEFAULT_ID}_in`;
        if (whereOurs in args)
          throw Error(`argument contains conflicting filter on ${whereOurs}`);
        const where = { ...args.where, [whereOurs]: list };

        const graphquery = argsToCosmosRequest([DEFAULT_ID], {
          ...args,
          where,
        });
        const result = await cosmosResolve(
          returnTypeCore.name,
          graphquery,
          context,
          container
        );
        return result;
      } else {
        return { nextCursor: null, page: [] };
      }
    }
  )(s, a, c, i);
};

export const resolveManyTheirs = (
  container: string,
  ours: string | undefined,
  theirs: string,
  fieldType: GraphQL.GraphQLField<any, any>
): GraphQL.GraphQLFieldResolver<any, any> => async (s, a, c, i) => {
  const returnTypeCore = GraphQL.getNamedType(fieldType.type);
  const ourId = s[ours ?? DEFAULT_ID];
  const whereTheirs = `${theirs}_in`;
  if (whereTheirs in a)
    throw Error(`argument contains conflicting filter on ${whereTheirs}`);
  const where = { ...a.where, [whereTheirs]: [ourId] };

  const graphquery = argsToCosmosRequest([DEFAULT_ID], { ...a, where });
  const result = await cosmosResolve(
    returnTypeCore.name,
    graphquery,
    c,
    container
  );
  return result;
};

export const resolveOneOurs = (
  typeFieldToContainer: Map<string, Map<string, string>>,
  ours: string | undefined,
  container: string,
  fieldType: GraphQL.GraphQLField<any, any>
): GraphQL.GraphQLFieldResolver<any, any> => (s, a, c, i) => {
  const objectContainer =
    getCosmosReferenceContainer(s) ??
    findOwnerContainer(typeFieldToContainer)(i.path);
  const returnTypeCore = GraphQL.getNamedType(fieldType.type);
  return resolveWithCosmosSource(
    objectContainer,
    DEFAULT_ID,
    ours ?? fieldType.name,
    async (source, _args, _context: GraphQLCosmosContext, _info) => {
      return toCosmosReference(
        returnTypeCore.name,
        container,
        source[ours ?? fieldType.name]
      );
    }
  )(s, a, c, i);
};

export const resolveOneTheirs = (
  container: string,
  ours: string | undefined,
  fieldType: GraphQL.GraphQLField<any, any>
): GraphQL.GraphQLFieldResolver<any, any> => (s, a, c, i) => {
  const returnTypeCore = GraphQL.getNamedType(fieldType.type);
  return resolveWithCosmosSource(
    container,
    DEFAULT_ID,
    ours ?? fieldType.name,
    async (source, _args, _context: GraphQLCosmosContext, info) => {
      return toCosmosReference(
        returnTypeCore.name,
        container,
        source[ours ?? info.fieldName]
      );
    }
  )(s, a, c, i);
};

export const findOwnerContainer = (data: Map<string, Map<string, string>>) => (
  path: GraphQL.ResponsePath
) => {
  return pathList(path)
    .map(
      (p) =>
        typeof p.typename === `string` &&
        typeof p.key === `string` &&
        data.get(p.typename)?.get(p.key)
    )
    .slice(1)
    .find((x): x is string => typeof x === `string`);
};

const pathList = (path?: GraphQL.ResponsePath) => {
  const entries: { typename: string | undefined; key: string | number }[] = [];
  for (let current = path; current; current = current.prev) {
    entries.push({ typename: current.typename, key: current.key });
  }
  return entries;
};
