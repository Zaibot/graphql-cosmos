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
  // kind: MetaFieldKind
}

export type MetaFieldKind =
  | 'one-root'
  | 'many-root'
  | 'one-ours'
  | 'many-ours'
  | 'one-theirs'
  | 'many-theirs'
  | 'embedded'

export function getMetaSchema(schema: GraphQLCosmosSchemaFromAst): MetaSchema {
  try {
    const types = schema.types.map((x) => getMetaType(x, schema)).sort((a, b) => a.typename.localeCompare(b.typename))

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
      fields: (type.fields ?? [])
        .map((x) => getMetaField(x, type, schema))
        .sort((a, b) => a.fieldname.localeCompare(b.fieldname)),
      filterable: (type.fields ?? []).some((x) => (x.whereOps ?? []).length > 0),
      sortable: (type.fields ?? []).some((x) => x.sortable),
    }
  } catch (ex) {
    throw new GraphQLCosmosInitError(`Type: ${type.typename}`, ex)
  }
}

export function getMetaField(
  field: GraphQLCosmosFieldFromAst,
  type: GraphQLCosmosTypeFromAst,
  schema: GraphQLCosmosSchemaFromAst
): MetaField {
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
      // kind: toRelationKind(!!field.container, !!field.ours, !!field.theirs, field.returnMany),
    }
  } catch (ex) {
    throw new GraphQLCosmosInitError(`Field: ${field.fieldname}`, ex)
  }
}

// function toRelationKind(container: boolean, ours: boolean, theirs: boolean, list: boolean): MetaFieldKind {
//   if (ours && theirs) {
//     throw Error(`expects ours or theirs not both`)
//   } else if (ours && list) {
//     // if (!container) throw Error(`expects container for many-ours`)
//     return 'many-ours'
//   } else if (ours) {
//     // if (!container) throw Error(`expects container for many-ours`)
//     return 'many-ours'
//   } else if (theirs && list) {
//     // if (!container) throw Error(`expects container for many-theirs`)
//     return 'many-theirs'
//   } else if (ours) {
//     // if (!container) throw Error(`expects container for one-ours`)
//     return 'one-ours'
//   } else if (theirs) {
//     // if (!container) throw Error(`expects container for one-theirs`)
//     return 'one-theirs'
//   } else if (list && container) {
//     return 'many-root'
//   } else {
//     if (container) throw Error(`expects no container for embedded`)
//     if (ours) throw Error(`expects no ours for embedded`)
//     if (theirs) throw Error(`expects no theirs for embedded`)
//     return 'embedded'
//   }
// }
