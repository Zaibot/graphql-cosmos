import { MetaIndex } from '../2-meta/3-meta-index'
import { defined, fail } from '../typescript'

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
  like = 'like',
  nlike = 'nlike',
  likelower = 'likelower',
  nlikelower = 'nlikelower',
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
  ncontains: Binary<T>
  containslower: Binary<T>
  ncontainslower: Binary<T>
  like: Binary<T>
  nlike: Binary<T>
  likelower: Binary<T>
  nlikelower: Binary<T>
  defined: Binary<T>
}

export const WhereBinaryPlural: Record<keyof WhereBinary, boolean> = {
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
  ncontains: false,
  containslower: false,
  ncontainslower: false,
  like: false,
  nlike: false,
  likelower: false,
  nlikelower: false,
  defined: false,
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

function canIgnoreOp(op: keyof WhereBinary, value: unknown) {
  if (op === `like` || op === `likelower`) {
    return !String(value).replaceAll(`%`, ``)
  } else if (op === `contains` || op === `containslower`) {
    return !String(value)
  } else {
    return false
  }
}

export function transformWhere(
  meta: MetaIndex,
  typename: string,
  output: Map<unknown, string>,
  where: Where,
  alias: string
): string[] {
  return where.flatMap((x) => {
    return Object.entries(x)
      .map(([op, arg]) => {
        if (op === `and`) {
          const conditions = transformWhere(meta, typename, output, arg as Where, alias)
          if (conditions.length === 0) {
            return null
          } else {
            return `(${conditions.join(` AND `)})`
          }
        } else if (op === `or`) {
          const conditions = transformWhere(meta, typename, output, arg as Where, alias)
          if (conditions.length === 0) {
            return null
          } else {
            return `(${conditions.join(` OR `)})`
          }
        } else {
          const [fieldname, value] = arg as Binary
          const parametername = output.get(value)
          const parametervalue = value
          const field = meta.whereField(typename, fieldname) ?? fail(`requires field ${typename}.${fieldname}`)
          const dbfieldname = field.whereOurs ?? field.ours ?? field.fieldname
          const ignored = isWhereOp(op) && canIgnoreOp(op, parametervalue)
          if (ignored) {
            return null
          } else {
            return transformBinary(
              op as keyof WhereBinary,
              [dbfieldname, parametername],
              Array.isArray(parametervalue),
              alias
            )
          }
        }
      })
      .filter(defined)
  })
}

function transformBinary(op: keyof WhereBinary, binary: Binary, secondIsArray: boolean, alias: string) {
  switch (op) {
    case 'defined':
      return `IS_DEFINED(${alias}.${binary[0]}) = ${binary[1]}`
    case 'contains':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
      }
    case 'containslower':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `CONTAINS(${alias}.${binary[0]}, ${binary[1]}, true)`
      }
    case 'ncontains':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `NOT CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
      }
    case 'ncontainslower':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `NOT CONTAINS(${alias}.${binary[0]}, ${binary[1]}, true)`
      }
    case 'eq':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `${alias}.${binary[0]} = ${binary[1]}`
      }
    case 'eqlower':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `STRINGEQUALS(${alias}.${binary[0]}, ${binary[1]}, true)`
      }
    case 'lt':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `${alias}.${binary[0]} < ${binary[1]}`
      }
    case 'ltlower':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `LOWER(${alias}.${binary[0]}) < LOWER(${binary[1]})`
      }
    case 'lte':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `${alias}.${binary[0]} <= ${binary[1]}`
      }
    case 'ltelower':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `LOWER(${alias}.${binary[0]}) <= LOWER(${binary[1]})`
      }
    case 'gt':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `${alias}.${binary[0]} > ${binary[1]}`
      }
    case 'gtlower':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `LOWER(${alias}.${binary[0]}) > LOWER(${binary[1]})`
      }
    case 'gte':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `${alias}.${binary[0]} >= ${binary[1]}`
      }
    case 'gtelower':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `LOWER(${alias}.${binary[0]}) >= LOWER(${binary[1]})`
      }
    case 'in':
      if (secondIsArray) {
        return `ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      } else {
        return `ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
      }
    case 'inlower':
      if (secondIsArray) {
        return `ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      } else {
        return `ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
      }
    case 'neq':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `${alias}.${binary[0]} != ${binary[1]}`
      }
    case 'neqlower':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `NOT STRINGEQUALS(${alias}.${binary[0]}, ${binary[1]}, true)`
      }
    case 'nin':
      if (secondIsArray) {
        return `NOT ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      } else {
        return `NOT ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
      }
    case 'ninlower':
      if (secondIsArray) {
        return `NOT ARRAY_CONTAINS(${binary[1]}, ${alias}.${binary[0]})`
      } else {
        return `NOT ARRAY_CONTAINS(${alias}.${binary[0]}, ${binary[1]})`
      }
    case 'like':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `${alias}.${binary[0]} LIKE ${binary[1]}`
      }
    case 'nlike':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `${alias}.${binary[0]} LIKE ${binary[1]}`
      }
    case 'likelower':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `LOWER(${alias}.${binary[0]}) LIKE ${binary[1]}`
      }
    case 'nlikelower':
      if (secondIsArray) {
        throw Error(`did not expect array as argument`)
      } else {
        return `LOWER(${alias}.${binary[0]}) LIKE ${binary[1]}`
      }
    default:
      throw Error(`unknown op: ${op}`)
  }
}
