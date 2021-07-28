import {
  ASTKindToNode,
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  TypeNode,
  visit,
  Visitor,
} from 'graphql'
import { MetaType } from '../2-meta/2-intermediate'
import { MetaIndex } from '../2-meta/3-meta-index'
import { GraphQLCosmosPageInputSort, GraphQLCosmosPageInputWhere } from '../5-resolvers/input-args'
import { SourceDescriptor } from '../5-resolvers/x-descriptors'
import { WhereBinaryPlural, WhereOps } from '../6-datasource/x-where'
import { fail, PromiseOrValue } from '../typescript'

export interface GraphQLCosmosPageInput {
  where?: GraphQLCosmosPageInputWhere
  sort?: GraphQLCosmosPageInputSort
  cursor?: string
  limit?: number
}

export interface GraphQLCosmosPageOutput<T extends { id: string }> {
  total: PromiseOrValue<number>
  cursor: PromiseOrValue<string | null>
  nextCursor: PromiseOrValue<string | null>
  page: PromiseOrValue<Array<SourceDescriptor.Embedded<T>>>
}

export class CosmosTypeDefsTransformer {
  constructor(public readonly map: MetaIndex) {}

  transform(doc: DocumentNode) {
    // Page Type
    for (const type of this.map.pageableTypes) {
      const pageType = this.generatePageType(type)
      doc = addType(doc, pageType)
    }

    // Where Type
    for (const type of this.map.whereableTypes) {
      const whereType = this.generateWhereType(type)
      doc = addType(doc, whereType)
    }

    // Sort Type
    for (const type of this.map.sortableTypes) {
      const sortType = this.generateSortType(type)
      doc = addType(doc, sortType)
    }

    // Cosmos Field
    doc = visit(doc, this.transformFieldWithCosmos())

    // Pageable Field
    doc = visit(doc, this.transformFieldWithPagination2())

    // Remove GraphQL Cosmos Directives
    const directiveNames = [`cosmos`, `where`, `sort`]
    doc = {
      ...doc,
      definitions: doc.definitions.filter((x) => {
        if (x.kind === `DirectiveDefinition` && directiveNames.includes(x.name.value)) {
        } else {
          return true
        }
      }),
    }
    doc = visit(doc, this.transformRemoveDirectives())

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
      like: false,
      nlike: false,
      likelower: false,
      nlikelower: false,
      defined: false,
    }

    const whereables = type.fields.filter((x) => x.whereOps?.length)
    const whereInputFields = whereables
      .flatMap((x) => (x.whereOps ?? []).map((y) => ({ field: x, op: y })))
      .map(
        (f): InputValueDefinitionNode =>
          makeInputValueDefinitionNode(
            `${f.field.whereOurs ?? f.field.fieldname}_${f.op}`,
            WhereBinaryPlural[f.op]
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
                }
          )
      )

    whereInputFields.unshift(
      makeInputValueDefinitionNode(`and`, {
        kind: `ListType`,
        type: {
          kind: `NonNullType`,
          type: { kind: `NamedType`, name: { kind: `Name`, value: `${type.typename}Where` } },
        },
      }),
      makeInputValueDefinitionNode(`or`, {
        kind: `ListType`,
        type: {
          kind: `NonNullType`,
          type: { kind: `NamedType`, name: { kind: `Name`, value: `${type.typename}Where` } },
        },
      })
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
      makeInputValueDefinitionNode(`${f.fieldname}_ASC`, { kind: `NamedType`, name: { kind: `Name`, value: `Int` } }),
      makeInputValueDefinitionNode(`${f.fieldname}_DESC`, { kind: `NamedType`, name: { kind: `Name`, value: `Int` } }),
    ])

    const sortType: DefinitionNode = {
      kind: `InputObjectTypeDefinition`,
      name: { kind: `Name`, value: `${type.typename}Sort` },
      fields: sortInputFields,
    }

    return sortType
  }

  transformRemoveDirectives(): Visitor<ASTKindToNode> {
    const directiveNames = [`cosmos`, `where`, `sort`]
    return {
      FieldDefinition(field) {
        return {
          ...field,
          directives: field.directives?.filter((x) => !directiveNames.includes(x.name.value)),
        }
      },
      ObjectTypeDefinition(field) {
        return {
          ...field,
          directives: field.directives?.filter((x) => !directiveNames.includes(x.name.value)),
        }
      },
      ObjectTypeExtension(field) {
        return {
          ...field,
          directives: field.directives?.filter((x) => !directiveNames.includes(x.name.value)),
        }
      },
    }
  }

  transformFieldWithPagination2(): Visitor<ASTKindToNode> {
    let objType: ObjectTypeDefinitionNode | ObjectTypeExtensionNode | null
    let doc: DocumentNode | null
    return {
      Document: {
        enter(d) {
          doc = d
        },
      },
      ObjectTypeDefinition: {
        enter(type) {
          objType = type
        },
      },
      ObjectTypeExtension: {
        enter(type) {
          objType = type
        },
      },
      FieldDefinition: {
        enter: (node) => {
          const typeName = objType?.name.value ?? fail(`no obj`)
          const fieldName = node.name.value

          const field = this.map.field(typeName, fieldName)
          if (!field) {
            return
          }

          if (doc && field.cosmos && field.pagination) {
            const args: InputValueDefinitionNode[] = []
            const nameWhered = `${field.returnTypename}Where`
            const nameSorted = `${field.returnTypename}Sort`
            const namePage = `${field.returnTypename}Page`
            const whereType: NamedTypeNode = { kind: `NamedType`, name: { kind: `Name`, value: nameWhered } }
            const sortType: NamedTypeNode = { kind: `NamedType`, name: { kind: `Name`, value: nameSorted } }
            const pageType: NamedTypeNode = { kind: `NamedType`, name: { kind: `Name`, value: namePage } }
            if (hasInputObjectTypeDefinition(doc, nameWhered)) {
              args.push(makeInputValueDefinitionNode(`where`, whereType))
            }
            if (hasInputObjectTypeDefinition(doc, nameSorted)) {
              args.push(makeInputValueDefinitionNode(`sort`, sortType))
            }
            args.push(
              makeInputValueDefinitionNode(`cursor`, { kind: `NamedType`, name: { kind: `Name`, value: `String` } })
            )
            args.push(
              makeInputValueDefinitionNode(`limit`, { kind: `NamedType`, name: { kind: `Name`, value: `Int` } })
            )
            const r: FieldDefinitionNode = {
              ...node,
              arguments: args,
              type: {
                kind: `NonNullType`,
                type: pageType,
              },
            }
            return r
          }
        },
      },
    }
  }

  transformFieldWithCosmos(): Visitor<ASTKindToNode> {
    let objType: ObjectTypeDefinitionNode | ObjectTypeExtensionNode | null
    let doc: DocumentNode | null
    return {
      Document: {
        enter(d) {
          doc = d
        },
      },
      ObjectTypeDefinition: {
        enter(type) {
          objType = type
        },
      },
      ObjectTypeExtension: {
        enter(type) {
          objType = type
        },
      },
      FieldDefinition: {
        enter: (node) => {
          const typeName = objType?.name.value ?? fail(`no obj`)
          const fieldName = node.name.value

          const type = this.map.type(typeName)
          const field = this.map.field(typeName, fieldName)
          if (type && field) {
            if (field.pagination) {
              // Will be handled by transformFieldWithPagination
            } else if (type.cosmos && field.cosmos && !field.returnMany) {
              // Single result field? And parent is from cosmos? No need to use filters.
            } else if (doc && field.cosmos && field.returnMany) {
              const args: InputValueDefinitionNode[] = []
              const nameWhered = `${field.returnTypename}Where`
              const nameSorted = `${field.returnTypename}Sort`
              const whereType: NamedTypeNode = { kind: `NamedType`, name: { kind: `Name`, value: nameWhered } } //(schema.getTypeMap()[nameWhered] ?? null) as GraphQLInputType | null
              const sortType: NamedTypeNode = { kind: `NamedType`, name: { kind: `Name`, value: nameSorted } } //(schema.getTypeMap()[nameSorted] ?? null) as GraphQLInputType | null
              if (hasInputObjectTypeDefinition(doc, nameWhered)) {
                args.push(makeInputValueDefinitionNode(`where`, whereType))
              }
              if (hasInputObjectTypeDefinition(doc, nameSorted)) {
                args.push(makeInputValueDefinitionNode(`sort`, sortType))
              }
              args.push(
                makeInputValueDefinitionNode(`limit`, { kind: `NamedType`, name: { kind: `Name`, value: `Int` } })
              )
              const r: FieldDefinitionNode = {
                ...node,
                arguments: args,
              }
              return r
            } else if (doc && field.cosmos && !field.returnMany) {
              const args: InputValueDefinitionNode[] = []
              const nameWhered = `${field.returnTypename}Where`
              const whereType: NamedTypeNode = { kind: `NamedType`, name: { kind: `Name`, value: nameWhered } } //(schema.getTypeMap()[nameWhered] ?? null) as GraphQLInputType | null
              if (hasInputObjectTypeDefinition(doc, nameWhered)) {
                args.push(makeInputValueDefinitionNode(`where`, whereType))
              }
              const r: FieldDefinitionNode = {
                ...node,
                arguments: args,
              }
              return r
            }
          }
        },
      },
    }
  }
}
function makeInputValueDefinitionNode(name: string, type: TypeNode): InputValueDefinitionNode {
  return {
    kind: `InputValueDefinition`,
    name: { kind: `Name`, value: name },
    type: type,
  }
}

function hasInputObjectTypeDefinition(doc: DocumentNode, name: string) {
  return doc.definitions.some((x) => x.kind === `InputObjectTypeDefinition` && x.name.value === name)
}

function addType(doc: DocumentNode, pageType: DefinitionNode) {
  doc = {
    ...doc,
    definitions: (doc.definitions ?? []).concat(pageType),
  }
  return doc
}
