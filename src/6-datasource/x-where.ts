import { MetaIndex } from '../2-meta/3-meta-index'
import { fail } from '../typescript'

export type Binary<T = unknown> = [string, T]

export enum WhereOps {
  lt = 'lt',
  ltlower = 'ltlower',
  lte = 'lte',
  ltelower = 'ltelower',
  gt = 'gt',
  gtlower = 'gtlower',
  gte = 'gte',
  gtelower = 'gtelower',
  eq = 'eq',
  eqlower = 'eqlower',
  neq = 'neq',
  neqlower = 'neqlower',
  in = 'in',
  inlower = 'inlower',
  nin = 'nin',
  ninlower = 'ninlower',
  contains = 'contains',
  containslower = 'containslower',
  ncontains = 'ncontains',
  defined = 'defined',
}

export const isWhereOp = (input: string | WhereOps): input is WhereOps => {
  return WhereOpSet.has(input)
}

export interface WhereBinary<T = unknown> {
  lt: Binary<T>
  ltlower: Binary<T>
  lte: Binary<T>
  ltelower: Binary<T>
  gt: Binary<T>
  gtlower: Binary<T>
  gte: Binary<T>
  gtelower: Binary<T>
  eq: Binary<T>
  eqlower: Binary<T>
  neq: Binary<T>
  neqlower: Binary<T>
  in: Binary<T>
  inlower: Binary<T>
  nin: Binary<T>
  ninlower: Binary<T>
  contains: Binary<T>
  containslower: Binary<T>
  ncontains: Binary<T>
  ncontainslower: Binary<T>
  defined: Binary<T>
}

export const WhereOpSet = new Set(Object.values(WhereOps)) as ReadonlySet<string>

export type WhereEntry<T> = Partial<WhereBinary & { and: Where<T>; or: Where<T> }>
export type Where<T = Record<string, unknown>> = Array<WhereEntry<T>>

export function indexWhere(where: Where) {
  let outputId = 0
  let output = new Map<unknown, string>()

  indexWhereRecursive(where)

  function indexWhereRecursive(where: Where) {
    for (const x of where) {
      for (const [op, arg] of Object.entries(x)) {
        if (op === `and`) {
          indexWhereRecursive(arg as Where)
        } else if (op === `or`) {
          indexWhereRecursive(arg as Where)
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
        return `(${transformWhere(meta, typename, output, arg as Where, alias).join(` AND `)})`
      } else if (op === `or`) {
        return `(${transformWhere(meta, typename, output, arg as Where, alias).join(` OR `)})`
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
  if (op === `defined`) return `IS_DEFINED(${alias}.${binary[0]}) = ${binary[1]}`
  else if (op === `contains`) return `CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else if (op === `containslower`) return `CONTAINS(${alias}.${binary[0]}, ${binary[1]}, true)`
  else if (op === `ncontains`) return `CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else if (op === `ncontainslower`) return `CONTAINS(${alias}.${binary[0]}, ${binary[1]}, true)`
  else if (op === `eq`) return `${alias}.${binary[0]} = ${binary[1]}`
  else if (op === `eqlower`) return `STRINGEQUALS(${alias}.${binary[0]}, ${binary[1]}, true)`
  else if (op === `lt`) return `${alias}.${binary[0]} < ${binary[1]}`
  else if (op === `ltlower`) return `LOWER(${alias}.${binary[0]}) < LOWER(${binary[1]})`
  else if (op === `lte`) return `${alias}.${binary[0]} <= ${binary[1]}`
  else if (op === `ltelower`) return `LOWER(${alias}.${binary[0]}) <= LOWER(${binary[1]})`
  else if (op === `gt`) return `${alias}.${binary[0]} > ${binary[1]}`
  else if (op === `gtlower`) return `LOWER(${alias}.${binary[0]}) > LOWER(${binary[1]})`
  else if (op === `gte`) return `${alias}.${binary[0]} >= ${binary[1]}`
  else if (op === `gtelower`) return `LOWER(${alias}.${binary[0]}) >= LOWER(${binary[1]})`
  else if (op === `in`)
    return secondIsArray
      ? `ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      : `ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else if (op === `inlower`)
    return secondIsArray
      ? `ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      : `ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else if (op === `neq`) return `${alias}.${binary[0]} != ${binary[1]}`
  else if (op === `neqlower`) return `NOT STRINGEQUALS(${alias}.${binary[0]}, ${binary[1]}, true)`
  else if (op === `nin`)
    return secondIsArray
      ? `NOT ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      : `NOT ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else if (op === `ninlower`)
    return secondIsArray
      ? `NOT ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      : `NOT ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
  else fail(`unknown op: ${op}`)
}
