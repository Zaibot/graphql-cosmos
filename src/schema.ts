import gql from 'graphql-tag';

export const schema = {
    typeDefs: gql`
        directive @cosmos(container: String, ours: String, theirs: String) on OBJECT | FIELD_DEFINITION
    `,
};
