import { FirebaseFirestore, QueryConstraint } from "firebase/firestore";
import { 
    collection as FirebaseCollection, 
    query as FirebaseQuery, 
    where as FirebaseWhere, 
    getDocs as FirebaseGetDocs, 
    orderBy as FirebaseOrderBy, 
    limit as FirebaseLimit,
    doc as FirebaseDoc, 
    getDoc as FirebaseGetDoc
} from "firebase/firestore";

import {
    GraphQLID,
    GraphQLList,
    GraphQLObjectType,
    GraphQLSchema,
    GraphQLInputObjectType,
    GraphQLInt,
    GraphQLInputFieldConfigMap,
    GraphQLInputType,
    GraphQLScalarType,
    GraphQLString,
    GraphQLFloat,
} from "graphql";
import { PubSub } from "graphql-subscriptions";
import { Definition } from "../firestore-link";

interface Context {
    database: FirebaseFirestore;
}

export type WhereInput = {
    [key: string]: String;
}

export type OrderByInput = {
    [key: string]: String;
}

export * from "../firestore-link";

export const pubsub = new PubSub();

const paginationFields = {
    skip: {
        type: GraphQLInt
    },
    take: {
        type: GraphQLInt
    },
    first: {
        type: GraphQLInt
    },
    last: {
        type: GraphQLInt
    },
}

export const GraphQLFirestoreCondition =  new GraphQLInputObjectType({
    name: 'GraphQLFirestoreCondition',
    fields: {
        op: {
            type: GraphQLString
        },
        value: {
            type: GraphQLFloat||GraphQLString
        }
    }
})

export const PaginationInputType = new GraphQLInputObjectType({
    name: 'Pagination',
    fields: paginationFields
}) 

export function createFullSchema(objectTypes: Definition[]): GraphQLSchema {

    const types = [] as Array<GraphQLObjectType | GraphQLInputObjectType>;

    const queryType = new GraphQLObjectType({
        name: "Query",
        fields: () => {
            const fields: any = {};
            objectTypes.forEach((definition) => {
                const objectType = definition.objectType;
                const typename = objectType.name;

                types.push(objectType)

                let inputFields = {} as GraphQLInputFieldConfigMap;
                let typeFields = objectType.getFields();

                Object.keys(typeFields).forEach(fieldKey => {
                    let fieldTypeMap = typeFields[fieldKey];

                    let type = fieldTypeMap.type;
                    let inputType = type as GraphQLInputType;

                    if(type instanceof GraphQLScalarType) {
                        switch(type.name) {

                            case 'String':
                                inputType = new GraphQLList(GraphQLString)
                            break;

                            case 'Float':
                                inputType = GraphQLFirestoreCondition
                            break;
                        }
                    }

                    inputFields[fieldKey] = {
                        type: inputType
                    }
                    
                })

                let objectTypeFilter = new GraphQLInputObjectType({
                    name: objectType.name + 'Filter',
                    fields: inputFields
                })

                types.push(objectTypeFilter)


                fields[typename.toLowerCase()] = {
                    type: objectType,
                    args: {
                        id: { type: GraphQLID },
                    },
                    resolve(_: any, { id }: any, context: Context) {
                        const docRef = FirebaseDoc(context.database, typename, id);
                        const result = FirebaseGetDoc(docRef);
                        return new Promise(resolve => {
                            result.then((doc) => {
                                if (doc.exists()) {
                                    let target = new definition.target()
                                    Object.assign(target, {
                                        id,
                                        ...doc.data(),
                                    })
                                    resolve(target)
                                } else {
                                    resolve(null)
                                }
                            })
                        })
                    },
                };

                fields[typename.toLowerCase() + 's'] = {
                    type: new GraphQLList(objectType),
                    args: {
                        where: {
                            type: objectTypeFilter
                        },
                        pagination: {
                            type: PaginationInputType
                        }
                    },
                    resolve(_: any, {where, pagination}: any, context: Context) {
                        let queryContraints = new Array<QueryConstraint>();
                        let fields = objectTypeFilter.getFields();
                        if(where) {
                            Object.keys(where).forEach((key)=>{
                                let type = fields[key].type;
                                let value = where[key];

                                if(type instanceof GraphQLList && value instanceof Array && value.length > 0) {
                                    queryContraints.push(FirebaseWhere(key, 'in', value))
                                }

                                if(type instanceof GraphQLInputObjectType) {
                                    switch(type.name) {
                                        case 'GraphQLFirestoreCondition':
                                            queryContraints.push(FirebaseWhere(key, value.op, value.value))
                                        break;
                                    }
                                    
                                }
                            })
                        }

                        if(pagination) {
                            if(pagination.skip) {
                                queryContraints.push(FirebaseOrderBy(pagination.skip))
                            }
                            if(pagination.take) {
                                console.debug(pagination.take);
                                queryContraints.push(FirebaseLimit(pagination.take))
                            }

                        }

                        let query = FirebaseQuery(FirebaseCollection(context.database, typename), ...queryContraints);

                        const result = FirebaseGetDocs(query);
                        return new Promise<any[]>(resolve => {
                            result.then((querySnapshot) => {
                                let list = [] as any[];
                                querySnapshot.forEach((doc) => {
                                    let target = new definition.target()
                                    Object.assign(target, doc.data())
                                    list.push(target);
                                });
                                resolve(list);
                            })
                        })
                    },
                };

            })
            return fields;
        },
    });

    types.push(PaginationInputType)

    return new GraphQLSchema({
        query: queryType,
        types: types
        // mutation: mutationType,
        // subscription: subscriptionType,
    });

    // function getBaseTypename(type: TypeNode): string {
    //     if (type.kind === "NonNullType" || type.kind === "ListType") {
    //         return getBaseTypename(type.type);
    //     } else {
    //         return type.name.value;
    //     }
    // }

    // function createFieldType(type: TypeNode, typeMapping: TypeMapping): GraphQLType {
    //     if (type.kind === "NonNullType") {
    //         return new GraphQLNonNull(createFieldType(type.type, typeMapping));
    //     } else if (type.kind === "ListType") {
    //         return new GraphQLList(createFieldType(type.type, typeMapping));
    //     } else {
    //         return typeMapping[type.name.value];
    //     }
    // }

    // function createObjectType(definition: ObjectTypeDefinitionNode, typeMapping: TypeMapping): GraphQLType {
    //     const typename = definition.name.value;

    //     if (!typeMapping[typename]) {
    //         typeMapping[typename] = new GraphQLObjectType({
    //             name: typename,
    //             fields: () => {
    //                 const fields: any = {};
    //                 if (definition.fields) {
    //                     for (const field of definition.fields) {
    //                         fields[field.name.value] = { type: createFieldType(field.type, typeMapping) };
    //                     }
    //                 }
    //                 return fields;
    //             },
    //         });
    //     }
    //     return typeMapping[typename];
    // }

    // function createInputFieldType(
    //     type: TypeNode,
    //     typeMapping: TypeMapping,
    //     objectDefinitions: ObjectDefinitions,
    // ): GraphQLType {
    //     if (type.kind === "NonNullType") {
    //         return new GraphQLNonNull(createFieldType(type.type, typeMapping));
    //     } else if (type.kind === "ListType") {
    //         return new GraphQLList(createFieldType(type.type, typeMapping));
    //     } else {
    //         const baseType = typeMapping[type.name.value];
    //         if (isLeafType(baseType)) {
    //             return baseType;
    //         }
    //         return createCreateInputObjectType(objectDefinitions[type.name.value], typeMapping, objectDefinitions);
    //     }
    // }

    // function createCreateInputObjectType(
    //     definition: GraphQLObjectType,
    //     typeMapping: TypeMapping,
    //     objectDefinitions: GraphQLObjectType[],
    // ): GraphQLInputObjectType {
    //     const typename = definition.name;

    //     console.debug( definition.toConfig().fields);

    //     const fields: any = {};
    //     // if (definition.toConfig().fields) {
    //     //     for (const field of definition.toConfig().fields) {
    //     //         const baseType = typeMapping[getBaseTypename(field.type)];
    //     //         if (isLeafType(baseType) && baseType !== GraphQLID) {
    //     //             fields[field.name.value] = { type: createInputFieldType(field.type, typeMapping, objectDefinitions) };
    //     //         }
    //     //     }
    //     // }
    //     const inputType = new GraphQLInputObjectType({
    //         name: `Create${typename}Input`,
    //         fields,
    //     });

    //     return inputType;
    // }

    // function createCreateMutation(
    //     objectType: GraphQLObjectType,
    //     typeMapping: TypeMapping,
    //     objectTypes: GraphQLObjectType[],
    // ) {
    //     const typename = objectType.name;

    //     const inputType = createCreateInputObjectType(objectType, typeMapping, objectTypes);

    //     return {
    //         type: typeMapping[typename],
    //         args: {
    //             input: { type: inputType },
    //         },
    //         async resolve(_: any, { input }: any, context: Context) {
    //             const result = await context.database.collection(typename).add(input);
    //             return {
    //                 id: result.id,
    //                 ...input,
    //             };
    //         },
    //     };
    // }

    // function createAddAndRemoveMutations(definition: GraphQLObjectType, typeMapping: TypeMapping) {
    //     const typename = definition.name;
    //     const mutations = new Map();

    //     if (definition.fields) {
    //         for (const field of definition.fields) {
    //             const fieldTypename = getBaseTypename(field.type);

    //             if (!isLeafType(typeMapping[fieldTypename])) {
    //                 const primaryId = `${typename.toLowerCase()}Id`;
    //                 const secondaryId = `${typename.toLowerCase()}Id`;
    //                 mutations.set(`add${toTitleCase(field.name.value)}To${typename}`, {
    //                     type: typeMapping[typename],
    //                     args: {
    //                         [primaryId]: { type: GraphQLID },
    //                         [secondaryId]: { type: GraphQLID },
    //                     },
    //                     async resolve(_: any, args: any, context: Context) {
    //                         await context.database.collection(fieldTypename).doc(args[secondaryId]).update({
    //                             [`__relations.${typename}.${field.name.value}`]: args[primaryId],
    //                         });
    //                         return args[primaryId];
    //                     },
    //                 });
    //             }
    //         }
    //     }

    //     return mutations;
    // }



    // const mutationType = new GraphQLObjectType({
    //     name: "Mutation",
    //     fields: () => {
    //         const fields: any = {};
    //         objectTypes.forEach((objectType) => {
    //             const typename = objectType.name;
    //             const definition = typeMapping[typename] as GraphQLObjectType;
    //             fields[`create${typename}`] = createCreateMutation(definition, typeMapping, objectTypes);
    //             // for (const [fieldKey, field] of createAddAndRemoveMutations(definition, typeMapping)) {
    //             //     fields[fieldKey] = field;
    //             // }
    //         });
    //         return fields;
    //     },
    // });

    // console.debug(mutationType);

    // const subscriptionType = new GraphQLObjectType({
    //     name: "Subscription",
    //     fields: () => {
    //         const fields: any = {};
    //         Object.keys(typeMapping).forEach((typename) => {
    //             fields[`${typename.toLowerCase()}Updated`] = {
    //                 type: typeMapping[typename],
    //                 args: {
    //                     id: { type: GraphQLID },
    //                 },
    //                 subscribe: (_: any, { id }: any, context: any) => {
    //                     const topic = `${typename.toLowerCase()}Updated:${id}`;
    //                     const iterator = pubsub.asyncIterator(topic);

    //                     context.database.collection(typename).doc(id)
    //                         .onSnapshot((doc: any) => {
    //                             pubsub.publish(topic, {
    //                                 id,
    //                                 ...doc.data(),
    //                             });
    //                         });

    //                     return iterator;
    //                 },
    //             };
    //         });
    //         return fields;
    //     },
    // });


}
