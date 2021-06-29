import { WhereOps } from '../6-datasource/x-where'
import { GraphQLCosmosInitError } from '../x-error/init-error'
import { GraphQLCosmosFieldFromAst, GraphQLCosmosSchemaFromAst, GraphQLCosmosTypeFromAst } from './1-ast'

export interface MetaSchema {
  types: MetaType[]
}

export interface MetaType {
  external: boolean
  typename: string
  database: string | null
  container: string | null
  fields: MetaField[]
}

export interface MetaField {
  fieldname: string
  returnMany: boolean
  returnTypename: string
  container: string | null
  database: string | null
  ours: string | null
  theirs: string | null
  pagination: boolean | null
  whereOps: WhereOps[] | null
  whereOurs: string | null
  sortable: boolean | null
  sortOurs: string | null
  kind: MetaFieldKind
}

export type MetaFieldKind = 'many-root' | 'one-ours' | 'many-ours' | 'one-theirs' | 'many-theirs' | 'embedded'

export function getMetaSchema(objectType: GraphQLCosmosSchemaFromAst): MetaSchema {
  try {
    const types = objectType.types.map(getMetaType).sort((a, b) => a.typename.localeCompare(b.typename))

    return {
      types,
    }
  } catch (ex) {
    throw new GraphQLCosmosInitError(`Error while generating meta schema`, ex)
  }
}

export function getMetaType(type: GraphQLCosmosTypeFromAst): MetaType {
  try {
    return {
      external: type.external,
      typename: type.typename,
      database: type.database,
      container: type.container,
      fields: (type.fields ?? []).map(getMetaField).sort((a, b) => a.fieldname.localeCompare(b.fieldname)),
    }
  } catch (ex) {
    throw new GraphQLCosmosInitError(`Type: ${type.typename}`, ex)
  }
}

export function getMetaField(field: GraphQLCosmosFieldFromAst): MetaField {
  try {
    return {
      returnTypename: field.returnTypename,
      fieldname: field.fieldname,
      database: field.database,
      pagination:
        field.pagination === 'on'
          ? true
          : field.pagination === 'off'
          ? false
          : field.returnMany && field.container !== null && field.ours === null,
      container: field.container,
      ours: field.ours,
      theirs: field.theirs,
      whereOps: field.whereOps,
      whereOurs: field.whereOurs,
      sortable: field.sortable,
      sortOurs: field.sortOurs,
      returnMany: field.returnMany,
      kind: toRelationKind(!!field.container, !!field.ours, !!field.theirs, field.returnMany),
    }
  } catch (ex) {
    throw new GraphQLCosmosInitError(`Field: ${field.fieldname}`, ex)
  }
}

function toRelationKind(container: boolean, ours: boolean, theirs: boolean, list: boolean): MetaFieldKind {
  if (ours && theirs) {
    throw Error(`expects ours or theirs not both`)
  } else if (ours && list) {
    // if (!container) throw Error(`expects container for many-ours`)
    return 'many-ours'
  } else if (theirs && list) {
    // if (!container) throw Error(`expects container for many-theirs`)
    return 'many-theirs'
  } else if (ours) {
    // if (!container) throw Error(`expects container for one-ours`)
    return 'one-ours'
  } else if (theirs) {
    // if (!container) throw Error(`expects container for one-theirs`)
    return 'one-theirs'
  } else if (list && container) {
    return 'many-root'
  } else {
    if (container) throw Error(`expects no container for embedded`)
    if (ours) throw Error(`expects no ours for embedded`)
    if (theirs) throw Error(`expects no theirs for embedded`)
    return 'embedded'
  }
}
