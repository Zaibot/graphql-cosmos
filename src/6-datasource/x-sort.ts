export type SortDirection = 'ASC' | 'DESC'
export type SortEntry = { fieldname: string; direction: SortDirection }
export type Sort = Array<SortEntry>

export function transformSort(sort: Sort, alias: string): string[] {
  return sort.map((x) => {
    const direction = x.direction === `ASC` ? `` : ` DESC`
    return `${alias}.${x.fieldname}${direction}`
  })
}
