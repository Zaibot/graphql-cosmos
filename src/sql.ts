export class SqlBuilder {
    readonly selects: string[] = [];
    readonly wheres: string[] = [];
    readonly orderBys: string[] = [];
    from: string = ``;

    constructor(from: string) {
        this.from = from;
    }

    where(condition: string) {
        this.wheres.push(condition);
        return this;
    }

    orderBy(property: string, direction: 'ASC' | 'DESC') {
        if (direction === `ASC`) {
            this.orderBys.push(`${property}`);
        } else {
            this.orderBys.push(`${property} ${direction}`);
        }
        return this;
    }

    select(column: string) {
        this.selects.push(column);
        return this;
    }

    toSql() {
        const select = this.selects.length ? `SELECT ${this.selects.join(`, `)}` : `SELECT *`;
        const from = ` FROM ${this.from}`;
        const where = this.wheres.length ? ` WHERE ${this.wheres.join(` AND `)}` : ``;
        const orderBy = this.orderBys.length ? ` ORDER BY ${this.orderBys.join(`, `)}` : ``;
        return `${select}${from}${where}${orderBy}`;
    }
}

export interface SqlParameter {
    name: string;
    value: unknown;
}
