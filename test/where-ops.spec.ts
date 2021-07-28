import { parse } from 'graphql'
import { MetaIndex } from '../src/2-meta/3-meta-index'
import { indexWhere, transformWhere, WhereBinaryPlural, WhereOps, WhereOpSet } from '../src/6-datasource/x-where'
import { createUnitTestContext } from './utils'

describe(`Where Operation`, () => {
  const ops = Object.values(WhereOps)
  const dummyTypeDefs = parse(`
    type Query {
      dummies: [Dummy] @cosmos
    }

    type Dummy @cosmos(database: "Test", container: "Dummies") {
      id: ID!
      value: String @where(op: "${ops.join(` `)}")
      list: [String] @where(op: "${ops.join(` `)}")
    }
  `)

  const uc = createUnitTestContext(dummyTypeDefs, {})

  for (const op of ops) {
    it(`${op} should match snapshot`, async () => {
      const where = [{ [op]: [`value`, `test`] }]
      const parameters = indexWhere(where)
      const query = transformWhere(new MetaIndex(uc.metaSchema), `Dummy`, parameters, where, `c`).join(` AND `)
      expect({
        query,
        parameters: Object.fromEntries(Array.from(parameters.entries()).map(([x, y]) => [y, x])),
      }).toMatchSnapshot()
    })

    it(`${op} (list result) should match snapshot`, async () => {
      const where = [{ [op]: [`list`, `test`] }]
      const parameters = indexWhere(where)
      const query = transformWhere(new MetaIndex(uc.metaSchema), `Dummy`, parameters, where, `c`).join(` AND `)
      expect({
        query,
        parameters: Object.fromEntries(Array.from(parameters.entries()).map(([x, y]) => [y, x])),
      }).toMatchSnapshot()
    })

    if (WhereBinaryPlural[op]) {
      it(`${op} (plural 1) should match snapshot`, async () => {
        const where = [{ [op]: [`value`, [`test`]] }]
        const parameters = indexWhere(where)
        const query = transformWhere(new MetaIndex(uc.metaSchema), `Dummy`, parameters, where, `c`).join(` AND `)
        expect({
          query,
          parameters: Object.fromEntries(Array.from(parameters.entries()).map(([x, y]) => [y, x])),
        }).toMatchSnapshot()
      })

      it(`${op} (plural 2) should match snapshot`, async () => {
        const where = [{ [op]: [`list`, [`test`]] }]
        const parameters = indexWhere(where)
        const query = transformWhere(new MetaIndex(uc.metaSchema), `Dummy`, parameters, where, `c`).join(` AND `)
        expect({
          query,
          parameters: Object.fromEntries(Array.from(parameters.entries()).map(([x, y]) => [y, x])),
        }).toMatchSnapshot()
      })
    }
  }
})
