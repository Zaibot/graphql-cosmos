import { SqlBuilder } from '../src/sql/builder';

test(`SQL`, () => {
    const expected = `SELECT * FROM Table`;
    const actual = new SqlBuilder(`Table`).toSql();
    expect(actual).toBe(expected);
});

test(`SQL with select`, () => {
    const expected = `SELECT Name, Description FROM Table`;
    const actual = new SqlBuilder(`Table`).select(`Name`).select(`Description`).toSql();
    expect(actual).toBe(expected);
});

test(`SQL with where`, () => {
    const expected = `SELECT * FROM Table WHERE Name = @parameter`;
    const actual = new SqlBuilder(`Table`).where(`Name = @parameter`).toSql();
    expect(actual).toBe(expected);
});
