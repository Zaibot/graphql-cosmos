import gql from 'graphql-tag'
import { SchemaDirectiveVisitor } from 'graphql-tools'
import { CosmosDirective } from './cosmos/directive'
import { SortDirective } from './sort/directive'
import { WhereDirective } from './where/directive'

export const GraphQLCosmosSchema = {
  typeDefs: gql`
    directive @cosmos(container: String, ours: String, theirs: String) on FIELD_DEFINITION
    directive @where(op: String, ours: String) on FIELD_DEFINITION
    directive @sort(ours: String) on FIELD_DEFINITION
  `,
  schema: `
    directive @cosmos(container: String, ours: String, theirs: String) on FIELD_DEFINITION
    directive @where(op: String, ours: String) on FIELD_DEFINITION
    directive @sort(ours: String) on FIELD_DEFINITION
  `,
  schemaDirectives: {
    cosmos: CosmosDirective as typeof SchemaDirectiveVisitor,
    where: WhereDirective as typeof SchemaDirectiveVisitor,
    sort: SortDirective as typeof SchemaDirectiveVisitor,
  },
}
