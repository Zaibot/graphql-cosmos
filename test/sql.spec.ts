import { SqlBuilder } from '../src/sql';

test(`SQL`, () => {
    const expected = `SELECT * FROM table`;
    const actual = new SqlBuilder(`table`).toSql();
    expect(actual).toBe(expected);
});

test(`SQL with select`, () => {
    const expected = `SELECT Name, Description FROM table`;
    const actual = new SqlBuilder(`table`).select(`Name`).select(`Description`).toSql();
    expect(actual).toBe(expected);
});

test(`SQL with where`, () => {
    const expected = `SELECT * FROM table WHERE Name = @parameter`;
    const actual = new SqlBuilder(`table`).where(`Name = @parameter`).toSql();
    expect(actual).toBe(expected);
});
