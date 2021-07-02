import gql from 'graphql-tag'
import { printSchemaWithDirectives } from 'graphql-tools'
import { createUnitTestContext } from './utils'

describe(`Address Book`, () => {
  const dummyTypeDefs = gql`
    type Query {
      person: Person @cosmos
      contact: Contact @cosmos
      people: [Person!]! @cosmos
    }

    type Person @cosmos(database: "AddressBook", container: "Persons") {
      id: ID @where(op: "eq")
      name: String! @where(op: "contains_lowercase")
      contacts: [Contact!]! @cosmos(theirs: "personId", pagination: "off")
      perferredContact: Contact @cosmos(ours: "preferredContactId")
    }

    type Contact @cosmos(database: "AddressBook", container: "Contacts") {
      id: ID @where(op: "eq")
      person: Person! @cosmos(ours: "personId")
      preferredBy: [Person!]! @cosmos(theirs: "preferredContactId", pagination: "off")
      phonenumber: String!
    }
  `

  const responses = {
    Persons: {
      'SELECT c.id FROM c ORDER BY c.id': [{ id: `alice` }, { id: `bob` }],
      'SELECT c.id, c.name FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=alice,bob)': [
        { id: `alice`, name: `Alice` },
        { id: `bob`, name: `Bob` },
      ],
    },
    Contacts: {
      'SELECT c.id FROM c WHERE c.personId = @p2 ORDER BY c.id (@p2=alice)': [{ id: `alice` }],
      'SELECT c.id FROM c WHERE c.personId = @p2 ORDER BY c.id (@p2=bob)': [{ id: `bob` }],
      'SELECT c.id, c.phonenumber FROM c WHERE ARRAY_CONTAINS(@p2, c.id) ORDER BY c.id (@p2=alice,bob)': [
        { id: `alice`, phonenumber: `555-111` },
        { id: `bob`, phonenumber: `555-222` },
      ],
    },
  }

  const uc = createUnitTestContext(dummyTypeDefs, responses)

  it(`expects schema to remain the same`, () => {
    const output = printSchemaWithDirectives(uc.schema)
    expect(output).toMatchSnapshot()
  })

  it(`expects meta schema to remain the same`, () => {
    const output = uc.metaSchema
    expect(output).toMatchSnapshot()
  })

  it(`should be retrieve all items`, async () => {
    const result = await uc.execute(`query { people { page { id name contacts { phonenumber } } } } `)

    expect(result).toEqual({
      data: {
        people: {
          page: [
            {
              contacts: [{ phonenumber: '555-111' }],
              id: 'alice',
              name: 'Alice',
            },
            {
              contacts: [{ phonenumber: '555-222' }],
              id: 'bob',
              name: 'Bob',
            },
          ],
        },
      },
    })
  })
})
