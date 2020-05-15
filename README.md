# apollo-link-cloud-firestore
Apollo GraphQL link for Cloud Firestore database

# Usage:

```javascript
    import { ObjectType, Field } from 'typegql';
    import { createFirestoreLink, TypesRegistry } from "apollo-link-cloud-firestore/src/firestore-link";
    import { Entity } from 'apollo-link-cloud-firestore/src/firestore-link';

    @Entity
    @ObjectType()
    class Entity {

        @Field()
        id: Int;

        @Field()
        name: string;
    }

    const firebaseConfig = {
        /* Firebase configuration JSON */
    }

    let defintions = [];

    TypesRegistry.forEach(model=>{
        defintions.push({
            target: model,
            objectType: compileObjectType(model)
        });
    })

    const firestoreLink = createFirestoreLink({
        firebaseConfig: firebaseConfig,
        definitions: defintions,
    });
```

# Disclaimer 

Please do not use it in production, is just a DRAFT version and has not all functionality implemented.