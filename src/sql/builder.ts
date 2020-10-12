export class SqlBuilder {
  readonly selects: string[] = []
  readonly wheres: string[] = []
  readonly orderBys: string[] = []
  from: string = ``
  _distinct = false
  _value = false

  constructor(from: string) {
    this.from = from
  }

  distinct(on = true) {
    this._distinct = on
    return this
  }

  value(on = true) {
    this._value = on
    return this
  }

  where(condition: string) {
    this.wheres.push(condition)
    return this
  }

  orderBy(property: string, direction: 'ASC' | 'DESC') {
    if (direction === `ASC`) {
      this.orderBys.push(`${property}`)
    } else {
      this.orderBys.push(`${property} ${direction}`)
    }
    return this
  }

  select(column: string) {
    this.selects.push(column)
    return this
  }

  toSql() {
    const distinct = this._distinct ? ` DISTINCT` : ``
    const value = this._value ? ` VALUE` : ``
    const select = this.selects.length ? ` ${this.selects.join(`, `)}` : ` *`
    const from = ` ${this.from}`
    const where = this.wheres.length ? ` WHERE ${this.wheres.join(` AND `)}` : ``
    const orderBy = this.orderBys.length ? ` ORDER BY ${this.orderBys.join(`, `)}` : ``
    return `SELECT${distinct}${value}${select} FROM${from}${where}${orderBy}`
  }
}

export interface SqlParameter {
  name: string
  value: unknown
}
