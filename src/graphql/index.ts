import { firestore } from "firebase";
import {
    GraphQLID,
    GraphQLList,
    GraphQLObjectType,
    GraphQLSchema,
    GraphQLString,
    GraphQLNonNull,
    GraphQLInputObjectType,
    GraphQLEnumType,
    GraphQLInt,
    GraphQLFieldMap,
    GraphQLInputFieldConfigMap,
    GraphQLInputType,
} from "graphql";
import { PubSub } from "graphql-subscriptions";
import { Definition } from "../firestore-link";

interface Context {
    database: firestore.Firestore;
}

export type WhereInput = {
    [key: string]: String;
}

export type OrderByInput = {
    [key: string]: String;
}

// interface TypeMapping {
//     [key: string]: GraphQLType;
// }

// interface ObjectDefinitions {
//     [key: string]: ObjectTypeDefinitionNode;
// }

export const pubsub = new PubSub();

function toTitleCase(str: string) {
    return str.charAt(0).toUpperCase() + str.substr(1);
}


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

export const PaginationInputType = new GraphQLInputObjectType({
    name: 'Pagination',
    fields: paginationFields
}) 



export function createFullSchema(objectTypes: Definition[]): GraphQLSchema {

    const types = [] as Array<GraphQLObjectType | GraphQLInputObjectType>;

    

    // objectTypes.forEach((definition) => {
        

    //     types.push(new GraphQLInputObjectType({
    //         name: 'Filter' + objectType.name + 'Input',
    //         fields: {
    //             filter: {
    //                 type: 

    //             }

    //         }
    //     }));
    // });


    

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
                    inputFields[fieldKey] = {
                        type: fieldTypeMap.type as GraphQLInputType
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
                        const result = context.database.collection(typename).doc(id).get();
                        return new Promise(resolve => {
                            result.then((doc) => {
                                if (doc.exists) {
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
                        let query = context.database.collection(typename) as firestore.Query 

                        if(where) {
                            Object.keys(where).forEach((key)=>{
                                query = query.where(key, '==', where[key])
                            })
                        }

                        const result = query.get();
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
