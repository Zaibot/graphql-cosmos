import { GraphQLResolveInfo } from 'graphql';
import { GraphQLCosmosContext } from '../../configuration';
import { argsToCosmosRequest, collectionResolver } from './common';

export const resolverCollection = async (
    typename: string,
    container: string,
    ours: string | undefined,
    theirs: string | undefined,
    source: Record<string, any>,
    args: Record<string, any>,
    context: GraphQLCosmosContext,
    _info: GraphQLResolveInfo,
) => {
    if (ours || theirs) {
        const ourValueOrList = source[ours ?? 'id'];
        if (Array.isArray(ourValueOrList)) {
            const whereOurs = `${theirs ?? 'id'}_in`;
            if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`);
            const where = { ...args.where, [whereOurs]: ourValueOrList };
            const graphquery = argsToCosmosRequest({ ...args, where });
            const result = await collectionResolver(typename, graphquery, context, container);
            return result;
        } else {
            const whereOurs = `${theirs ?? 'id'}_eq`;
            if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`);
            const where = { ...args.where, [whereOurs]: ourValueOrList };
            const graphquery = argsToCosmosRequest({ ...args, where });
            const result = await collectionResolver(typename, graphquery, context, container);
            return result;
        }
    } else {
        const graphquery = argsToCosmosRequest(args);
        const result = await collectionResolver(typename, graphquery, context, container);
        return result;
    }
};
