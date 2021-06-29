import type { GraphQLFieldResolver } from 'graphql/type/definition'
import { GraphQLCosmosConceptContext } from '../6-datasource/1-context'
import type { SourceDescriptor } from './x-descriptors'

export type GraphQLCosmosFieldResolver<TSource = unknown, TContext = unknown> = GraphQLFieldResolver<
  SourceDescriptor.Embedded<TSource>,
  TContext & GraphQLCosmosConceptContext
>
