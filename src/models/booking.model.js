// src/models/booking.model.js
import { getDb, hasMaterialized } from "../config/mongo.js";

/** =========================
 *  Constantes & utilidades
 *  ========================= */
export const ALLOWED_STATUS = new Set(["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"]);
const MATERIALIZED_COLLECTION = "bookings_mat";

const CREATE_FIELDS = [
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

function assertValidStatus(doc) {
  if (doc.status !== undefined && !ALLOWED_STATUS.has(String(doc.status))) {
    const err = new Error(`status inválido. Permitidos: ${[...ALLOWED_STATUS].join(", ")}`);
    err.status = 400;
    throw err;
  }
}

function toDateOrISO(v) {
  if (v instanceof Date) return v;
  if (v === undefined || v === null) return undefined;
  const d = new Date(v);
  return isNaN(d) ? undefined : d.toISOString();
}

function isBlank(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "" || s === "null" || s === "undefined";
}

/** =========================
 *  Normalización de escrituras
 *  ========================= */
function normalizeOnCreate(doc) {
  // ids como string
  if (doc._id != null) doc._id = String(doc._id);
  if (doc.showtime_id != null) doc.showtime_id = String(doc.showtime_id);
  if (doc.movie_id != null) doc.movie_id = String(doc.movie_id);
  if (doc.cinema_id != null) doc.cinema_id = String(doc.cinema_id);
  if (doc.sala_id != null) doc.sala_id = String(doc.sala_id);

  if (doc.sala_number != null) doc.sala_number = Number(doc.sala_number);
  if (doc.price_total != null) doc.price_total = Number(doc.price_total);

  // user básico
  if (doc.user && typeof doc.user === "object") {
    if (doc.user.user_id != null) doc.user.user_id = String(doc.user.user_id);
    if (doc.user.email != null) doc.user.email = String(doc.user.email);
    if (doc.user.name != null) doc.user.name = String(doc.user.name);
  }

  // seats: aseguramos array
  if (doc.seats && !Array.isArray(doc.seats)) doc.seats = [doc.seats];

  // created_at por defecto
  doc.created_at = doc.created_at ? String(toDateOrISO(doc.created_at)) : new Date().toISOString();

  assertValidStatus(doc);
  return doc;
}

function normalizeForPatch(allowed) {
  const out = { ...allowed };
  if (out.sala_number != null) out.sala_number = Number(out.sala_number);
  if (out.price_total != null) out.price_total = Number(out.price_total);

  if (out.user && typeof out.user === "object") {
    const u = { ...out.user };
    if (u.user_id != null) u.user_id = String(u.user_id);
    if (u.email != null) u.email = String(u.email);
    if (u.name != null) u.name = String(u.name);
    out.user = u;
  }

  if (out.seats && !Array.isArray(out.seats)) out.seats = [out.seats];

  assertValidStatus(out);
  return out;
}

/** =========================
 *  Filtros / sort / paginación
 *  ========================= */
function buildFilter(q) {
  const f = {};
  if (!isBlank(q.id) || !isBlank(q._id) || !isBlank(q.booking_id)) f._id = q.id || q._id || q.booking_id;
  if (!isBlank(q.movie_id))    f.movie_id = q.movie_id;
  if (!isBlank(q.cinema_id))   f.cinema_id = q.cinema_id;
  if (!isBlank(q.showtime_id)) f.showtime_id = q.showtime_id;
  if (!isBlank(q.user_id))     f["user.user_id"] = q.user_id;
  if (!isBlank(q.status))          f.status = q.status;
  if (!isBlank(q.source))          f.source = q.source;
  if (!isBlank(q.payment_method))  f.payment_method = q.payment_method;

  if (!isBlank(q.email)) {
    const e = String(q.email).toLowerCase();
    f.$or = [{ email_norm: e }, { "user.email": q.email }];
  }

  const from = !isBlank(q.date_from) ? new Date(q.date_from) : null;
  const to   = !isBlank(q.date_to)   ? new Date(q.date_to)   : null;
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

function parseLimit(v, def = 50, max = 200) {
  const n = parseInt(v ?? def, 10);
  if (Number.isNaN(n) || n < 1) return def;
  return Math.min(n, max);
}
function parsePage(v, def = 1) {
  const n = parseInt(v ?? def, 10);
  if (Number.isNaN(n) || n < 1) return def;
  return n;
}

/** =========================
 *  Etapas comunes de agregación
 *  ========================= */
function aggNormalizeFieldsStage() {
  return {
    $addFields: {
      // Normaliza created_at -> Date (acepta Date, epoch o string ISO)
      created_at_dt: {
        $cond: [
          { $eq: [{ $type: "$created_at" }, "date"] },
          "$created_at",
          {
            $cond: [
              { $in: [{ $type: "$created_at" }, ["int", "long", "double", "decimal"]] },
              { $toDate: "$created_at" },
              {
                $dateFromString: {
                  dateString: { $toString: "$created_at" },
                  onError: null,
                  onNull: null
                }
              }
            ]
          }
        ]
      },
      // email normalizado
      email_norm: { $toLower: { $ifNull: ["$user.email", ""] } }
    }
  };
}

/** =========================
 *  Materializador
 *  ========================= */
function matAddFieldsStage() {
  return {
    $addFields: {
      // Reusa la misma lógica que en list()
      created_at_dt: {
        $cond: [
          { $eq: [{ $type: "$created_at" }, "date"] },
          "$created_at",
          {
            $cond: [
              { $in: [{ $type: "$created_at" }, ["int", "long", "double", "decimal"]] },
              { $toDate: "$created_at" },
              {
                $dateFromString: {
                  dateString: { $toString: "$created_at" },
                  onError: null,
                  onNull: null
                }
              }
            ]
          }
        ]
      },
      email_norm: { $toLower: { $ifNull: ["$user.email", ""] } },
      seat_count: { $size: { $ifNull: ["$seats", []] } },
      created_at_pe: {
        $dateFromString: {
          dateString: {
            $dateToString: {
              date: { $ifNull: ["$created_at_dt", new Date(0)] },
              format: "%Y-%m-%dT%H:%M:%S.%LZ"
            }
          },
          timezone: "America/Lima",
          onError: null,
          onNull: null
        }
      }
    }
  };
}

function matMergeStage() {
  return {
    $merge: {
      into: MATERIALIZED_COLLECTION,
      on: "_id",
      whenMatched: "replace",
      whenNotMatched: "insert"
    }
  };
}

export async function ensureMatIndexes() {
  const db = getDb();
  const col = db.collection(MATERIALIZED_COLLECTION);
  await col.createIndex({ _id: 1 }, { unique: true });
  await col.createIndex({ created_at_dt: -1 });
  await col.createIndex({ email_norm: 1 });
  await col.createIndex({ "user.user_id": 1 });
  await col.createIndex({ movie_id: 1 });
  await col.createIndex({ cinema_id: 1 });
  await col.createIndex({ showtime_id: 1 });
  await col.createIndex({ status: 1 });
  await col.createIndex({ payment_method: 1 });
  await col.createIndex({ source: 1 });
}

export async function refreshAll({ rebuild = false } = {}) {
  const db = getDb();

  if (rebuild) {
    const exists = (await db.listCollections({ name: MATERIALIZED_COLLECTION }).toArray()).length > 0;
    if (exists) await db.collection(MATERIALIZED_COLLECTION).drop();
  }

  await db.collection("bookings").aggregate([
    matAddFieldsStage(),
    matMergeStage()
  ]).toArray();

  await ensureMatIndexes();
}

// Interno: materializa un documento por id (soporta _id string/ObjectId)
async function refreshOne(id) {
  const db = getDb();
  const idStr = String(id);
  const matchStage = {
    $match: { $expr: { $eq: [{ $toString: "$_id" }, idStr] } }
  };

  await db.collection("bookings").aggregate([
    matchStage,
    matAddFieldsStage(),
    matMergeStage()
  ]).toArray();
}

/** =========================
 *  API del modelo
 *  ========================= */
export async function list(query) {
  const db = getDb();
  const collation = { locale: "es", strength: 1 };

  const filter = buildFilter(query);
  const sort = buildSort(query.sort);
  const limit = parseLimit(query.limit);
  const page  = parsePage(query.page);
  const skip  = (page - 1) * limit;

  if (hasMaterialized()) {
    const cur = db.collection(MATERIALIZED_COLLECTION)
      .find(filter, { collation })
      .sort(sort).skip(skip).limit(limit);
    const data = await cur.toArray();

    // permite respuesta "lisa" si ?flat=1/true
    if (String(query.flat).toLowerCase() === "true" || String(query.flat) === "1") {
      return data;
    }
    return { page, limit, count: data.length, data };
  }

  const pipe = [
    aggNormalizeFieldsStage(),
    { $match: filter },
    { $sort: sort },
    { $skip: skip },
    { $limit: limit }
  ];
  const data = await db.collection("bookings").aggregate(pipe, { collation }).toArray();

  if (String(query.flat).toLowerCase() === "true" || String(query.flat) === "1") {
    return data;
  }
  return { page, limit, count: data.length, data };
}

export async function getById(id) {
  const db = getDb();
  // Búsqueda tolerante a _id string / ObjectId
  const idStr = String(id);
  return db.collection("bookings").findOne({
    $expr: { $eq: [{ $toString: "$_id" }, idStr] }
  });
}

export async function create(body) {
  const db = getDb();
  const doc = normalizeOnCreate(pick(body, CREATE_FIELDS));
  await db.collection("bookings").insertOne(doc);
  if (hasMate
