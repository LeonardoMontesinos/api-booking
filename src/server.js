import "dotenv/config";
import app from "./app.js";
import { connectMongo } from "./config/mongo.js";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "bookingsdb";
const PORT = process.env.PORT || 3000;

if (!MONGODB_URI) {
    console.error("Falta MONGODB_URI en .env");
    process.exit(1);
}

const { db } = await connectMongo(MONGODB_URI, DB_NAME);
app.locals.db = db;
app.listen(PORT, () => console.log(`API bookings escuchando en :${PORT}`));
