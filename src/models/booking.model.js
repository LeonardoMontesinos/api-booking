import { getDb, hasMaterialized } from "../config/mongo.js";

const CREATE_WHITELIST = [
    "_id","showtime_id","movie_id","cinema_id","sala_id","sala_number",
    "seats","user","payment_method","source","status","price_total","currency","created_at"
];

const MUTABLE_FIELDS = new Set([
    "seats","user","payment_method","source","status","price_total","currency"
]);

const IMMUTABLE_FIELDS = new Set([
    "_id","showtime_id","movie_id","cinema_id","sala_id","sala_number","created_at"
]);

function pick(obj, keys) {
    const out = {};
    for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
    return out;
}

function ensureNoImmutable(body) {
    const invalid = Object.keys(body).filter(k => IMMUTABLE_FIELDS.has(k));
    if (invalid.length) {
        const err = new Error(`No se pueden modificar: ${invalid.join(", ")}`);
        err.status = 400;
        throw err;
    }
}

function normalizeOnWrite(doc) {
    if (!doc.created_at) doc.created_at = new Date().toISOString();
    return doc;
}

function buildFilter(q) {
    const f = {};
    if (q.id || q._id || q.booking_id) f._id = q.id || q._id || q.booking_id;
    if (q.movie_id)    f.movie_id = q.movie_id;
    if (q.cinema_id)   f.cinema_id = q.cinema_id;
    if (q.showtime_id) f.showtime_id = q.showtime_id;
    if (q.user_id)     f["user.user_id"] = q.user_id;
    if (q.status)          f.status = q.status;
    if (q.source)          f.source = q.source;
    if (q.payment_method)  f.payment_method = q.payment_method;

    if (q.email) {
        const e = String(q.email).toLowerCase();
        f.$or = [{ email_norm: e }, { "user.email": q.email }];
    }

    const from = q.date_from ? new Date(q.date_from) : null;
    const to   = q.date_to   ? new Date(q.date_to)   : null;
    if (from || to) {
        f.created_at_dt = {};
        if (from) f.created_at_dt.$gte = from;
        if (to)   f.created_at_dt.$lt  = to;
    }
    return f;
}

function buildSort(sort) {
    const s = {};
    const key = sort && typeof sort === "string" ? sort : "-created_at_dt";
    if (key.startsWith("-")) s[key.slice(1)] = -1; else s[key] = 1;
    return s;
}

export async function list(query) {
    const db = getDb();
    const collation = { locale: "es", strength: 1 };

    const filter = buildFilter(query);
    const sort = buildSort(query.sort);
    const limit = Math.min(parseInt(query.limit || 50, 10), 200);
    const page  = Math.max(parseInt(query.page || 1, 10), 1);
    const skip  = (page - 1) * limit;

    if (hasMaterialized()) {
        const cur = db.collection("bookings_mat")
            .find(filter, { collation }).sort(sort).skip(skip).limit(limit);
        const data = await cur.toArray();
        return { page, limit, count: data.length, data };
    }

    const pipe = [
        {
            $addFields: {
                created_at_dt: {
                    $cond: [
                        { $eq: [ { $type: "$created_at" }, "date" ] },
                        "$created_at",
                        { $dateFromString: { dateString: "$created_at" } }
                    ]
                },
                email_norm: { $toLower: "$user.email" }
            }
        },
        { $match: filter },
        { $sort: sort },
        { $skip: skip },
        { $limit: limit }
    ];
    const data = await db.collection("bookings").aggregate(pipe, { collation }).toArray();
    return { page, limit, count: data.length, data };
}

export async function getById(id) {
    const db = getDb();
    return db.collection("bookings").findOne({ _id: id });
}

export async function create(body) {
    const db = getDb();
    const doc = normalizeOnWrite(pick(body, CREATE_WHITELIST));
    await db.collection("bookings").insertOne(doc);
    if (hasMaterialized()) await refreshOne(doc._id);
    return doc;
}

export async function replace(id, body) {
    ensureNoImmutable(body);
    const db = getDb();
    const allowed = {};
    for (const k of Object.keys(body)) if (MUTABLE_FIELDS.has(k)) allowed[k] = body[k];
    const r = await db.collection("bookings").findOneAndUpdate(
        { _id: id }, { $set: allowed }, { returnDocument: "after" }
    );
    if (!r.value) return null;
    if (hasMaterialized()) await refreshOne(id);
    return r.value;
}

export async function patch(id, body) {
    ensureNoImmutable(body);
    const db = getDb();

    const allowed = {};
    for (const k of Object.keys(body)) if (MUTABLE_FIELDS.has(k)) allowed[k] = body[k];
    if (Object.keys(allowed).length === 0) throw new Error("No hay campos válidos para actualizar");

    const r = await db.collection("bookings").findOneAndUpdate(
        { _id: id },
        { $set: allowed },
        { returnDocument: "after" }
    );

    // Si Mongo devolvió null pero el update se aplicó (nModified = 1), traemos el documento actualizado manualmente
    if (!r.value && r.lastErrorObject?.n === 1) {
        return await db.collection("bookings").findOne({ _id: id });
    }

    return r.value; // si realmente no existe, devolverá null y el controller dará 404
}


export async function remove(id) {
    const db = getDb();
    const r = await db.collection("bookings").deleteOne({ _id: id });
    if (hasMaterialized()) await db.collection("bookings_mat").deleteOne({ _id: id });
    return r.deletedCount === 1;
}

async function refreshOne(id) {
    const db = getDb();
    const pipe = [
        { $match: { _id: id } },
        {
            $addFields: {
                created_at_dt: {
                    $cond: [
                        { $eq: [ { $type: "$created_at" }, "date" ] },
                        "$created_at",
                        { $dateFromString: { dateString: "$created_at" } }
                    ]
                },
                created_at_pe: {
                    $cond: [
                        { $eq: [ { $type: "$created_at" }, "date" ] },
                        "$created_at",
                        { $dateFromString: { dateString: "$created_at", timezone: "America/Lima" } }
                    ]
                },
                seat_count: { $size: { $ifNull: ["$seats", []] } },
                email_norm: { $toLower: "$user.email" }
            }
        },
        { $merge: { into: "bookings_mat", on: "_id", whenMatched: "replace", whenNotMatched: "insert" } }
    ];
    await db.collection("bookings").aggregate(pipe).toArray();
}
