graphql-cosmos

# Concept

@cosmos(container, ours, theirs)

The `container` argument indicates the value of the field is stored in a different Cosmos Container

The `ours` argument tells the resolver that this entity owns the information and specifies what underlying column to use. Combined with `container` this indicates the relational ID column.

The `theirs` argument tells the resolver that the relational information is owned by an entity in the `container` Cosmos Container.

Pseudo code:

```
Person {
    id
    name
    preferredContactId?
}

Contact {
    id
    personId
    phonenumber
}
```

```graphql
type Query {
  people: [Person!]! @cosmos
}

type Person @cosmos(database: "AddressBook", container: "Persons") {
  id: ID
  name: String!
  contacts: [Contact!]! @cosmos(theirs: "personId")
  perferredContact: Contact @cosmos(ours: "preferredContactId")
}

type Contact @cosmos(database: "AddressBook", container: "Contacts") {
  person: Person! @cosmos(ours: "personId")
  preferredBy: [Person!]! @cosmos(theirs: "preferredContactId")
  phonenumber: String!
}
```
