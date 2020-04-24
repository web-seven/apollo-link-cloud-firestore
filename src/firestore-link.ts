import { ApolloLink, Observable } from "apollo-link";
import { LoggingLink } from 'apollo-logger';
 
import {
    getMainDefinition
} from "apollo-utilities";
import {
    createSourceEventStream,
    execute,
    OperationTypeNode,
    ExecutionResult,
    GraphQLObjectType,
} from "graphql";
import { ExecutionResultDataDefault } from "graphql/execution/execute";
import { createFullSchema } from "./graphql";

import { app as FirebaseApp, initializeApp, firestore } from "firebase";
import uniqid from "uniqid";

export type Constructor = new () => Object;

export interface Definition {
    target: Constructor
    objectType: GraphQLObjectType,
}

export interface Options {
    firebaseApp?: FirebaseApp.App
    firebaseConfig?: Object 
    definitions: Definition[],
}

export function createFirestoreLink({ firebaseApp, firebaseConfig, definitions }: Options): ApolloLink {

    if(!firebaseApp && !firebaseConfig) {
        throw Error('For Firestore link, required Firebase Application or Firebase Configuration to be provided');
    }

    if(firebaseConfig) {
        var app = initializeApp(
            firebaseConfig,
            "firebaseApp-" + uniqid()
        );
        firebaseApp = app;        
    }

    var database = firestore(firebaseApp);
    const settings = {};
    database.settings(settings);

    let firestoreLink = new ApolloLink((operation, forward) => {

        const { query, variables, operationName } = operation;
        const context = { database };
        const rootValue = {};
        const mainDefinition = getMainDefinition(query);
        const schema = createFullSchema(definitions);
        // console.debug(schema);
        const operationType: OperationTypeNode =
            mainDefinition.kind === "OperationDefinition" ? mainDefinition.operation : "query";
        if (operationType === "subscription") {
            return new Observable((observer) => {
                let stream = createSourceEventStream(
                    schema,
                    query,
                    rootValue,
                    context,
                    variables,
                    operationName,
                ) as Promise<ExecutionResult>

                stream.then((iterator: ExecutionResult<ExecutionResultDataDefault>) => {
                    if (iterator.data) {
                        iterator.data.foreach((data: ExecutionResultDataDefault) => {
                            observer.next({ data });
                        })
                    }

                });
            });
        }
        return new Observable((observer) => {
            const result = execute(
                schema,
                query,
                rootValue,
                context,
                variables,
                operationName,
            );

            if(result instanceof Promise) {
                result
                    .then((data: any) => {
                        observer.next(data);
                        observer.complete();
                    })
                    .catch((err: any) => {
                        if (err.name === "AbortError") { return; }
                        if (err.result && err.result.errors) {
                            observer.next(err.result);
                        }
                        observer.error(err);
                    });
            } else {
                observer.next(result);
                observer.complete();
            }
            
        });
    });

    const logOptions = { logger: console.log };

    return ApolloLink.from([new LoggingLink(logOptions),firestoreLink]);
}
