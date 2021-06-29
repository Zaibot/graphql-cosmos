import { fail } from '../typescript'
import { MetaField, MetaSchema, MetaType } from './2-intermediate'

export class MetaIndex {
  readonly typeMap: ReadonlyMap<string, MetaType>
  readonly fieldMap: ReadonlyMap<string, MetaField>
  readonly sortFieldMap: ReadonlyMap<string, MetaField>
  readonly whereFieldMap: ReadonlyMap<string, MetaField>

  constructor(schema: MetaSchema) {
    this.typeMap = new Map(schema.types.map((t) => [t.typename, t]))
    this.fieldMap = new Map(schema.types.flatMap((t) => t.fields.map((f) => [`${t.typename}.${f.fieldname}`, f])))
    this.sortFieldMap = this.buildSortMap(schema)
    this.whereFieldMap = this.buildWhereMap(schema)
  }

  private buildWhereMap(schema: MetaSchema) {
    const whereFieldMap = new Map()
    for (const type of schema.types) {
      for (const field of type.fields) {
        whereFieldMap.set(`${type.typename}.${field.fieldname}`, field)
        whereFieldMap.set(`${type.typename}.${field.ours ?? field.fieldname}`, field)
        whereFieldMap.set(`${type.typename}.${field.whereOurs ?? field.ours ?? field.fieldname}`, field)
      }
    }
    return whereFieldMap
  }

  private buildSortMap(schema: MetaSchema) {
    const sortFieldMap = new Map<string, MetaField>()
    for (const type of schema.types) {
      for (const field of type.fields) {
        sortFieldMap.set(`${type.typename}.${field.fieldname}`, field)
        sortFieldMap.set(`${type.typename}.${field.ours ?? field.fieldname}`, field)
        sortFieldMap.set(`${type.typename}.${field.sortOurs ?? field.ours ?? field.fieldname}`, field)
      }
    }
    return sortFieldMap
  }

  get allTypes() {
    return Array.from(this.typeMap.values())
  }

  get whereableTypes() {
    return Array.from(this.typeMap.values()).filter((t) => t.fields.some((x) => x.whereOps?.length))
  }

  get sortableTypes() {
    return Array.from(this.typeMap.values()).filter((t) => t.fields.some((x) => x.sortable))
  }

  get pageableTypes() {
    return unique(
      Array.from(this.typeMap.values())
        .flatMap((x) => x.fields)
        .filter(
          (x) =>
            (x.pagination && this.type(x.returnTypename)) ||
            (x.container === null && this.type(x.returnTypename)?.container)
        )
        .map((x) => this.requireType(x.returnTypename))
    )
  }

  type(typename: string) {
    return this.typeMap.get(typename)
  }

  field(typename: string, fieldname: string) {
    return this.fieldMap.get(`${typename}.${fieldname}`)
  }

  whereField(typename: string, fieldname: string) {
    return this.whereFieldMap.get(`${typename}.${fieldname}`)
  }

  sortField(typename: string, fieldname: string) {
    return this.sortFieldMap.get(`${typename}.${fieldname}`)
  }

  requireType(typename: string) {
    return this.typeMap.get(typename) ?? fail(`meta type missing: ${typename}`)
  }

  requireField(typename: string, fieldname: string) {
    return this.fieldMap.get(`${typename}.${fieldname}`) ?? fail(`meta field missing: ${typename}.${fieldname}`)
  }
}

function unique<T>(array: T[]) {
  return Array.from(new Set(array).values())
}
