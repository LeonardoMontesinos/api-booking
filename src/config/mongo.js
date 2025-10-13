import { MongoClient } from "mongodb";

let client, db, hasMat = false;

export async function connectMongo(uri, dbName) {
    client = new MongoClient(uri, {
        maxPoolSize: 30,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000
    });
    await client.connect();
    db = client.db(dbName);

    const cols = await db.listCollections({}, { nameOnly: true }).toArray();
    hasMat = cols.some(c => c.name === "bookings_mat");
    return { client, db, hasMat };
}

export function getDb() {
    if (!db) throw new Error("MongoDB no inicializado");
    return db;
}

export function hasMaterialized() {
    return hasMat;
}
