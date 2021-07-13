import { WhereOps } from '../6-datasource/x-where'
import { GraphQLCosmosInitError } from '../x-error/init-error'
import { GraphQLCosmosFieldFromAst, GraphQLCosmosSchemaFromAst, GraphQLCosmosTypeFromAst } from './1-ast'

export interface MetaSchema {
  types: MetaType[]
}

export interface MetaType {
  cosmos: boolean
  external: boolean
  typename: string
  database: string | null
  container: string | null
  fields: MetaField[]
  filterable: boolean | null
  sortable: boolean | null
}

export interface MetaField {
  cosmos: boolean
  fieldname: string
  returnMany: boolean
  returnTypename: string
  container: string | null
  database: string | null
  ours: string | null
  theirs: string | null
  pagination: boolean
  whereOps: WhereOps[] | null
  whereOurs: string | null
  sortable: boolean | null
  sortOurs: string | null
}

export function getMetaSchema(schema: GraphQLCosmosSchemaFromAst): MetaSchema {
  try {
    const types = schema.types
      .map((type) => getMetaType(type, schema))
      .sort((a, b) => a.typename.localeCompare(b.typename))

    return {
      types,
    }
  } catch (ex) {
    throw new GraphQLCosmosInitError(`Error while generating meta schema`, ex)
  }
}

export function getMetaType(type: GraphQLCosmosTypeFromAst, schema: GraphQLCosmosSchemaFromAst): MetaType {
  try {
    return {
      cosmos: type.cosmos,
      external: type.external,
      typename: type.typename,
      database: type.database,
      container: type.container,
      fields: type.fields
        .map((field) => getMetaField(field, schema))
        .sort((a, b) => a.fieldname.localeCompare(b.fieldname)),
      filterable: type.fields.some((x) => (x.whereOps ?? []).length > 0),
      sortable: type.fields.some((x) => x.sortable),
    }
  } catch (ex) {
    throw new GraphQLCosmosInitError(`Type: ${type.typename}`, ex)
  }
}

export function getMetaField(field: GraphQLCosmosFieldFromAst, schema: GraphQLCosmosSchemaFromAst): MetaField {
  try {
    const returnType = schema.types.find((x) => x.typename === field.returnTypename) ?? null

    const autoPagination = returnType?.cosmos === true && field.ours === null && field.returnMany
    const pagination = field.pagination === 'on' ? true : field.pagination === 'off' ? false : autoPagination
    return {
      cosmos: field.cosmos,
      returnTypename: field.returnTypename,
      fieldname: field.fieldname,
      database: field.database ?? returnType?.database ?? null,
      pagination: pagination,
      container: field.container ?? returnType?.container ?? null,
      ours: field.ours,
      theirs: field.theirs,
      whereOps: field.whereOps,
      whereOurs: field.whereOurs,
      sortable: field.sortable,
      sortOurs: field.sortOurs,
      returnMany: field.returnMany,
    }
  } catch (ex) {
    throw new GraphQLCosmosInitError(`Field: ${field.fieldname}`, ex)
  }
}
