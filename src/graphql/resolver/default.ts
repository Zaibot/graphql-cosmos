import * as GraphQL from 'graphql'
import { SchemaVisitorMap, visitSchema } from 'graphql-tools'
import { debugHooks } from '../../debug'
import { cosmosOursByResolveInfo, cosmosTheirsByResolveInfo } from '../directive/ast'
import { hasCosmosTag } from '../reference'
import { hasId, requireCosmosColumn } from './requireCosmosColumn'

export function buildCosmosFieldResolverSchema(schema: GraphQL.GraphQLSchema) {
  const map: SchemaVisitorMap = {
    'VisitSchemaKind.OBJECT_TYPE'(type) {
      for (const field of Object.values(type.getFields())) {
        debugHooks?.onResolverSet?.({
          resolver: `requireCosmosColumn`,
          objectType: type,
          fieldType: field,
        })

        field.resolve = DefaultCosmosFieldResolver(field)
      }
      return type
    },
  }
  const schema2 = visitSchema(schema, map)
  return schema2
}

function DefaultCosmosFieldResolver(field: GraphQL.GraphQLField<any, any, { [key: string]: any }>) {
  const nextResolver = field.resolve ?? GraphQL.defaultFieldResolver
  const cosmosResolver: typeof nextResolver = async (s: unknown, a, c, i) => {
    if (hasCosmosTag(s) && hasId(s) && !cosmosTheirsByResolveInfo(i)) {
      const ours = cosmosOursByResolveInfo(i)
      const column = ours ?? field.name
      const sourced = await requireCosmosColumn(s, column, c)
      const result = await nextResolver(sourced, a, c, i)
      return result
    } else {
      return await nextResolver(s, a, c, i)
    }
  }
  return cosmosResolver
}
