import { mapSchema } from '@graphql-tools/utils'
import {
  DefinitionNode,
  extendSchema,
  GraphQLFieldConfigArgumentMap,
  GraphQLInputType,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLOutputType,
  GraphQLSchema,
  GraphQLString,
  InputValueDefinitionNode,
} from 'graphql'
import { SchemaMapper } from '@graphql-tools/utils'
import { MetaType } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { WhereOps } from '../6-datasource/x-where'
import { fail } from '../typescript'

export class CosmosSchemaTransformer {
  constructor(public readonly map: MetaIndex) {}

  transform(doc: GraphQLSchema) {
    // Page Type
    for (const type of this.map.pageableTypes) {
      const pageType = this.generatePageType(type)
      doc = extendSchema(doc, { kind: `Document`, definitions: [pageType] })
    }

    // Where Type
    for (const type of this.map.whereableTypes) {
      const whereType = this.generateWhereType(type)
      doc = extendSchema(doc, { kind: `Document`, definitions: [whereType] })
    }

    // Sort Type
    for (const type of this.map.sortableTypes) {
      const sortType = this.generateSortType(type)
      doc = extendSchema(doc, { kind: `Document`, definitions: [sortType] })
    }

    // Cosmos Field
    doc = mapSchema(doc, this.transformFieldWithCosmos())

    // Pageable Field
    doc = mapSchema(doc, this.transformFieldWithPagination())

    // Remove GraphQL Cosmos Directives
    doc = mapSchema(doc, this.transformRemoveDirectives())

    return doc
  }

  generatePageType(type: MetaType) {
    const pageType: DefinitionNode = {
      kind: `ObjectTypeDefinition`,
      name: { kind: `Name`, value: `${type.typename}Page` },
      fields: [
        {
          kind: `FieldDefinition`,
          name: { kind: `Name`, value: `total` },
          type: { kind: `NonNullType`, type: { kind: `NamedType`, name: { kind: `Name`, value: `Int` } } },
        },
        {
          kind: `FieldDefinition`,
          name: { kind: `Name`, value: `cursor` },
          type: { kind: `NamedType`, name: { kind: `Name`, value: `String` } },
        },
        {
          kind: `FieldDefinition`,
          name: { kind: `Name`, value: `nextCursor` },
          type: { kind: `NamedType`, name: { kind: `Name`, value: `String` } },
        },
        {
          kind: `FieldDefinition`,
          name: { kind: `Name`, value: `page` },
          type: {
            kind: `NonNullType`,
            type: { kind: `ListType`, type: { kind: `NamedType`, name: { kind: `Name`, value: type.typename } } },
          },
        },
      ],
    }

    return pageType
  }

  generateWhereType(type: MetaType): DefinitionNode {
    const isPlural: Record<WhereOps, boolean> = {
      lt: false,
      ltlower: false,
      lte: false,
      ltelower: false,
      gt: false,
      gtlower: false,
      gte: false,
      gtelower: false,
      eq: false,
      eqlower: false,
      neq: false,
      neqlower: false,
      in: true,
      inlower: true,
      nin: true,
      ninlower: true,
      contains: false,
      containslower: false,
      ncontains: false,
    }

    const whereables = type.fields.filter((x) => x.whereOps?.length)
    const whereInputFields = whereables
      .flatMap((x) => (x.whereOps ?? []).map((y) => ({ field: x, op: y })))
      .map(
        (f): InputValueDefinitionNode => ({
          kind: `InputValueDefinition`,
          name: { kind: `Name`, value: `${f.field.whereOurs ?? f.field.fieldname}_${f.op}` },
          type: isPlural[f.op]
            ? {
                kind: `ListType`,
                type: {
                  kind: `NamedType`,
                  name: {
                    kind: `Name`,
                    value: this.map.type(f.field.returnTypename) ? `String` : f.field.returnTypename,
                  },
                },
              }
            : {
                kind: `NamedType`,
                name: {
                  kind: `Name`,
                  value: this.map.type(f.field.returnTypename) ? `String` : f.field.returnTypename,
                },
              },
        })
      )

    whereInputFields.unshift(
      {
        kind: `InputValueDefinition`,
        name: { kind: `Name`, value: `and` },
        type: {
          kind: `ListType`,
          type: {
            kind: `NonNullType`,
            type: { kind: `NamedType`, name: { kind: `Name`, value: `${type.typename}Where` } },
          },
        },
      },
      {
        kind: `InputValueDefinition`,
        name: { kind: `Name`, value: `or` },
        type: {
          kind: `ListType`,
          type: {
            kind: `NonNullType`,
            type: { kind: `NamedType`, name: { kind: `Name`, value: `${type.typename}Where` } },
          },
        },
      }
    )

    const whereType: DefinitionNode = {
      kind: `InputObjectTypeDefinition`,
      name: { kind: `Name`, value: `${type.typename}Where` },
      fields: whereInputFields,
    }

    return whereType
  }

  generateSortType(type: MetaType) {
    const sortables = type.fields.filter((x) => x.sortable)
    const sortInputFields = sortables.flatMap((f): InputValueDefinitionNode[] => [
      {
        kind: `InputValueDefinition`,
        name: { kind: `Name`, value: `${f.fieldname}_ASC` },
        type: { kind: `NamedType`, name: { kind: `Name`, value: `Int` } },
      },
      {
        kind: `InputValueDefinition`,
        name: { kind: `Name`, value: `${f.fieldname}_DESC` },
        type: { kind: `NamedType`, name: { kind: `Name`, value: `Int` } },
      },
    ])

    const sortType: DefinitionNode = {
      kind: `InputObjectTypeDefinition`,
      name: { kind: `Name`, value: `${type.typename}Sort` },
      fields: sortInputFields,
    }

    return sortType
  }

  transformRemoveDirectives(): SchemaMapper | undefined {
    const directiveNames = [`cosmos`, `where`, `sort`]
    return {
      'MapperKind.DIRECTIVE'(config) {
        if (directiveNames.includes(config.name)) {
          return null
        } else {
          return config
        }
      },
      'MapperKind.OBJECT_TYPE'(type) {
        if (type.astNode) {
          const directives = type.astNode.directives?.filter((x) => !directiveNames.includes(x.name.value))
          type.astNode = { ...type.astNode, directives }
          return type
        } else {
          return type
        }
      },
      'MapperKind.OBJECT_FIELD'(config) {
        if (config.astNode) {
          const directives = config.astNode.directives?.filter((x) => !directiveNames.includes(x.name.value))
          return { ...config, astNode: { ...config.astNode, directives } }
        } else {
          return config
        }
      },
    }
  }

  transformFieldWithPagination(): SchemaMapper {
    return {
      'MapperKind.OBJECT_FIELD': (config, fieldName, typeName, schema) => {
        const field = this.map.field(typeName, fieldName)
        if (!field) {
          return
        }

        if (field.cosmos && field.pagination) {
          const args: GraphQLFieldConfigArgumentMap = {}

          const nameWhered = `${field.returnTypename}Where`
          const nameSorted = `${field.returnTypename}Sort`
          const namePaged = `${field.returnTypename}Page`

          const whereType = (schema.getTypeMap()[nameWhered] ?? null) as GraphQLInputType | null
          const sortType = (schema.getTypeMap()[nameSorted] ?? null) as GraphQLInputType | null
          const pageType = (schema.getTypeMap()[namePaged] ?? fail(`page missing: ${namePaged}`)) as GraphQLOutputType

          if (whereType) {
            args.where = { type: whereType }
          }
          if (sortType) {
            args.sort = { type: sortType }
          }
          args.cursor = { type: GraphQLString }
          args.limit = { type: GraphQLInt }

          return { ...config, args: args, type: new GraphQLNonNull(pageType) }
        }
      },
    }
  }

  transformFieldWithCosmos(): SchemaMapper {
    return {
      'MapperKind.OBJECT_FIELD': (config, fieldName, typeName, schema) => {
        const type = this.map.type(typeName)
        const field = this.map.field(typeName, fieldName)
        if (type && field) {
          if (field.pagination) {
            // Will be handled by transformFieldWithPagination
          } else if (type.cosmos && field.cosmos && !field.returnMany) {
            // Single result field? And parent is from cosmos? No need to use filters.
          } else if (field.cosmos && field.returnMany) {
            const args: GraphQLFieldConfigArgumentMap = {}

            const nameWhered = `${field.returnTypename}Where`
            const nameSorted = `${field.returnTypename}Sort`

            const whereType = (schema.getTypeMap()[nameWhered] ?? null) as GraphQLInputType | null
            const sortType = (schema.getTypeMap()[nameSorted] ?? null) as GraphQLInputType | null

            if (whereType) {
              args.where = { type: whereType }
            }
            if (sortType) {
              args.sort = { type: sortType }
            }
            args.limit = { type: GraphQLInt }

            return { ...config, args: args }
          } else if (field.cosmos && !field.returnMany) {
            const args: GraphQLFieldConfigArgumentMap = {}

            const nameWhered = `${field.returnTypename}Where`

            const whereType = (schema.getTypeMap()[nameWhered] ?? null) as GraphQLInputType | null

            if (whereType) {
              args.where = { type: whereType }
            }

            return { ...config, args: args }
          }
        }
      },
    }
  }
}
