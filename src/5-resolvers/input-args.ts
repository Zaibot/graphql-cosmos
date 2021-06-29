import { fail } from '../typescript'
import { Sort } from '../6-datasource/x-sort'
import { Where, WhereOpSet } from '../6-datasource/x-where'

export type GraphQLCosmosPageInputWhere = Record<string, unknown>
export type GraphQLCosmosPageInputSort = Record<string, number>

export function parseInputWhere(input: GraphQLCosmosPageInputWhere): Where {
  const wheres: Where = []
  for (const [key_op, value] of Object.entries(input)) {
    const idx = key_op.lastIndexOf(`_`)
    const key = key_op.substring(0, idx)
    const op = key_op.substring(idx + 1)

    if (op === `and`) {
      wheres.push({ and: (value as GraphQLCosmosPageInputWhere[]).flatMap(parseInputWhere) })
    } else if (op === `or`) {
      wheres.push({ or: (value as GraphQLCosmosPageInputWhere[]).flatMap(parseInputWhere) })
    } else if (WhereOpSet.has(op)) {
      wheres.push({ [op]: [key, value] })
    } else {
      fail(`expected valid op, not: ${key} ${op}`)
    }
  }
  return wheres
}

export function parseInputSort(input: GraphQLCosmosPageInputSort): Sort {
  const sorts: Sort = []
  for (const [key_direction] of Object.entries(input).sort((a, b) => a[1] - b[1])) {
    const idx = key_direction.lastIndexOf(`_`)
    const key = key_direction.substring(0, idx)
    const op = key_direction.substring(idx + 1)

    if (op === `ASC` || op === `DESC`) {
      sorts.push({ fieldname: key, direction: op })
    } else {
      fail(`expected asc or desc, not: ${op}`)
    }
  }
  return sorts
}
