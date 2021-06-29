import { MetaIndex } from '../2-meta/3-meta-index'
import { fail } from '../typescript'

export type Binary<T = unknown> = [string, T]

export enum WhereOps {
  lt = 'lt',
  lt_lowercase = 'lt_lowercase',
  lte = 'lte',
  lte_lowercase = 'lte_lowercase',
  gt = 'gt',
  gt_lowercase = 'gt_lowercase',
  gte = 'gte',
  gte_lowercase = 'gte_lowercase',
  eq = 'eq',
  eq_lowercase = 'eq_lowercase',
  neq = 'neq',
  neq_lowercase = 'neq_lowercase',
  in = 'in',
  in_lowercase = 'in_lowercase',
  nin = 'nin',
  nin_lowercase = 'nin_lowercase',
  contains = 'contains',
  contains_lowercase = 'contains_lowercase',
  ncontains = 'ncontains',
}

export const isWhereOp = (input: string | WhereOps): input is WhereOps => {
  return WhereOpSet.has(input)
}

export interface WhereBinary<T = unknown> {
  lt: Binary<T>
  lt_lowercase: Binary<T>
  lte: Binary<T>
  lte_lowercase: Binary<T>
  gt: Binary<T>
  gt_lowercase: Binary<T>
  gte: Binary<T>
  gte_lowercase: Binary<T>
  eq: Binary<T>
  eq_lowercase: Binary<T>
  neq: Binary<T>
  neq_lowercase: Binary<T>
  in: Binary<T>
  in_lowercase: Binary<T>
  nin: Binary<T>
  nin_lowercase: Binary<T>
  contains: Binary<T>
  contains_lowercase: Binary<T>
  ncontains: Binary<T>
  ncontains_lowercase: Binary<T>
}

export const WhereOpSet = new Set(Object.values(WhereOps)) as ReadonlySet<string>

export type WhereEntry<T> = Partial<WhereBinary & { and: Where<T>; or: Where<T> }>
export type Where<T = Record<string, unknown>> = Array<WhereEntry<T>>

export function indexWhere(where: Where) {
  let outputId = 0
  let output = new Map<unknown, string>()

  indexWhere2(where)

  function indexWhere2(where: Where) {
    for (const x of where) {
      for (const [op, arg] of Object.entries(x)) {
        if (op === `and`) {
          indexWhere2(arg as Where)
        } else if (op === `or`) {
          indexWhere2(arg as Where)
        } else {
          const [, value] = arg as Binary
          if (output.has(`@p${outputId}`)) {
            output.get(value)
          } else {
            outputId++
            output.set(value, `@p${++outputId}`)
          }
        }
      }
    }
  }
  return output
}
export function transformWhere(
  meta: MetaIndex,
  typename: string,
  output: Map<unknown, string>,
  where: Where,
  alias: string
): string[] {
  return where.flatMap((x) => {
    return Object.entries(x).map(([op, arg]) => {
      if (op === `and`) {
        return transformWhere(meta, typename, output, arg as Where, alias).join(` AND `)
      } else if (op === `or`) {
        return transformWhere(meta, typename, output, arg as Where, alias).join(` OR `)
      } else {
        const [fieldname, value] = arg as Binary
        const parametername = output.get(value)
        const parametervalue = value
        const field = meta.whereField(typename, fieldname) ?? fail(`requires field ${typename}.${fieldname}`)
        const dbfieldname = field.whereOurs ?? field.ours ?? field.fieldname
        return transformBinary(
          op as keyof WhereBinary,
          [dbfieldname, parametername],
          Array.isArray(parametervalue),
          alias
        )
      }
    })
  })
}

function transformBinary(op: keyof WhereBinary, binary: Binary, secondIsArray: boolean, alias: string) {
  if (op === `contains`) return `CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else if (op === `contains_lowercase`) return `CONTAINS(${alias}.${binary[0]}, ${binary[1]}, true)`
  else if (op === `ncontains`) return `CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else if (op === `ncontains_lowercase`) return `CONTAINS(${alias}.${binary[0]}, ${binary[1]}, true)`
  else if (op === `eq`) return `${alias}.${binary[0]} = ${binary[1]}`
  else if (op === `eq_lowercase`) return `STRINGEQUALS(${alias}.${binary[0]}, ${binary[1]}, true)`
  else if (op === `lt`) return `${alias}.${binary[0]} < ${binary[1]}`
  else if (op === `lt_lowercase`) return `LOWER(${alias}.${binary[0]}) < LOWER(${binary[1]})`
  else if (op === `lte`) return `${alias}.${binary[0]} <= ${binary[1]}`
  else if (op === `lte_lowercase`) return `LOWER(${alias}.${binary[0]}) <= LOWER(${binary[1]})`
  else if (op === `gt`) return `${alias}.${binary[0]} > ${binary[1]}`
  else if (op === `gt_lowercase`) return `LOWER(${alias}.${binary[0]}) > LOWER(${binary[1]})`
  else if (op === `gte`) return `${alias}.${binary[0]} >= ${binary[1]}`
  else if (op === `gte_lowercase`) return `LOWER(${alias}.${binary[0]}) >= LOWER(${binary[1]})`
  else if (op === `in`)
    return secondIsArray
      ? `ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      : `ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else if (op === `in_lowercase`)
    return secondIsArray
      ? `ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      : `ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else if (op === `neq`) return `${alias}.${binary[0]} != ${binary[1]}`
  else if (op === `neq_lowercase`) return `NOT STRINGEQUALS(${alias}.${binary[0]}, ${binary[1]}, true)`
  else if (op === `nin`)
    return secondIsArray
      ? `NOT ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      : `NOT ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else if (op === `nin_lowercase`)
    return secondIsArray
      ? `NOT ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      : `NOT ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else fail(`unknown op: ${op}`)
}
