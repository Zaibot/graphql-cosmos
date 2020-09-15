import { GraphQLResolveInfo } from 'graphql';
import { GraphQLCosmosContext } from '../../configuration';
import { collectionResolver, argsToCosmosRequest } from './common';

export const resolverOne = async (
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
        const whereOurs = `${theirs ?? 'id'}_eq`;
        if (whereOurs in args) throw Error(`argument contains conflicting filter on ${whereOurs}`);
        const where = { ...args.where, [whereOurs]: ourValueOrList };
        const graphquery = argsToCosmosRequest({ ...args, where });
        const result = await collectionResolver(typename, graphquery, context, container);
        return result.page?.[0];
    } else {
        const graphquery = argsToCosmosRequest(args);
        const result = await collectionResolver(typename, graphquery, context, container);
        return result.page?.[0];
    }
};
