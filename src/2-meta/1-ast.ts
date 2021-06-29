import {
  DefinitionNode,
  DocumentNode,
  FieldDefinitionNode,
  ListTypeNode,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  TypeNode,
} from 'graphql'
import { isListTypeNode } from 'graphql-tools'
import { Directives } from '../1-graphql/2-ast'
import { isWhereOp, WhereOps } from '../6-datasource/x-where'

export interface GraphQLCosmosSchemaFromAst {
  types: GraphQLCosmosTypeFromAst[]
}

export interface GraphQLCosmosTypeFromAst {
  external: boolean
  typename: string
  database: string | null
  container: string | null
  fields: GraphQLCosmosFieldFromAst[]
}

export interface GraphQLCosmosFieldFromAst {
  external: boolean
  fieldname: string
  returnTypename: string
  returnMany: boolean
  container: string | null
  database: string | null
  ours: string | null
  theirs: string | null
  whereOps: WhereOps[] | null
  whereOurs: string | null
  sortable: boolean | null
  sortOurs: string | null
  pagination: string | null
}

export function getGraphQLCosmosSchemaFromGraphQL(objectType: DocumentNode): GraphQLCosmosSchemaFromAst {
  const internalTypes = (objectType.definitions ?? []).filter(isObjectTypeDefinition).map(getGraphQLCosmosTypeFromGraphQL)
  const externalTypes = (objectType.definitions ?? []).filter(isObjectTypeExtension).map(getGraphQLCosmosTypeFromGraphQL)

  return {
    types: [...internalTypes, ...externalTypes],
  }
}

export function getGraphQLCosmosTypeFromGraphQL(objectType: ObjectTypeDefinitionNode | ObjectTypeExtensionNode): GraphQLCosmosTypeFromAst {
  const typename = objectType.name.value
  const fields = (objectType.fields ?? []).map(getGraphQLCosmosFieldFromGraphQL)
  const database = Directives.cosmosDatabaseDirective(objectType.directives ?? []) ?? null
  const container = Directives.cosmosContainerDirective(objectType.directives ?? []) ?? null

  return {
    external: objectType.kind === `ObjectTypeExtension`,
    typename: typename,
    database,
    container,
    fields,
  }
}

export function getGraphQLCosmosFieldFromGraphQL(field: FieldDefinitionNode): GraphQLCosmosFieldFromAst {
  const returnTypename = astGetNamedType(field.type).name.value
  const returnMany = isListTypeNode(astGetNullable(field.type))
  const database = Directives.cosmosDatabaseDirective(field.directives ?? []) ?? null
  const container = Directives.cosmosContainerDirective(field.directives ?? []) ?? null
  const pagination = Directives.cosmosPaginationDirective(field.directives ?? []) ?? null
  const fieldname = field.name.value
  const ours = Directives.cosmosOursDirective(field.directives ?? []) ?? null
  const theirs = Directives.cosmosTheirsDirective(field.directives ?? []) ?? null
  const whereOps = Directives.whereOpDirective(field.directives ?? []).filter(isWhereOp) ?? null
  const whereOurs = Directives.whereOursDirective(field.directives ?? []) ?? null
  const sortable = Directives.sortDirective(field.directives ?? []) ?? null
  const sortOurs = Directives.sortOursDirective(field.directives ?? []) ?? null

  return {
    external: false,
    returnTypename,
    returnMany,
    database,
    container,
    fieldname,
    ours,
    theirs,
    whereOps,
    whereOurs,
    sortable,
    sortOurs,
    pagination,
  }
}

function astGetNamedType(type: TypeNode): NamedTypeNode {
  while (type.kind === `ListType` || type.kind === `NonNullType`) {
    type = type.type
  }
  return type
}

function isObjectTypeDefinition(n: DefinitionNode): n is ObjectTypeDefinitionNode {
  return n.kind === `ObjectTypeDefinition`
}

function isObjectTypeExtension(n: DefinitionNode): n is ObjectTypeExtensionNode {
  return n.kind === `ObjectTypeExtension`
}

function astGetNullable(type: TypeNode): ListTypeNode | NamedTypeNode {
  while (type.kind === `NonNullType`) {
    type = type.type
  }
  return type
}
