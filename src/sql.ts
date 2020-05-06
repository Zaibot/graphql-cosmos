export class SqlBuilder {
    readonly selects: string[] = [];
    readonly wheres: string[] = [];
    from: string = ``;

    constructor(from: string) {
        this.from = from;
    }

    where(condition: string) {
        this.wheres.push(condition);
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
        return `${select}${from}${where}`;
    }
}

export interface SqlParameter {
    name: string;
    value: unknown;
}
