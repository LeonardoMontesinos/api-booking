// models/booking.model.js
import { getDb, hasMaterialized } from "../config/mongo.js";

/** ---------- Constantes & utilidades ---------- */
export const ALLOWED_STATUS = new Set(["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"]);

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

/** Normaliza campos en escritura (create) */
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

/** Normaliza parcial para $set (patch/replace) */
function normalizeForPatch(allowed) {
  const out = { ...allowed };
  if (out.sala_number != null) out.sala_number = Number(out.sala_number); // por si acaso
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

/** Filtros / sort / paginación */
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

/** ---------- API del modelo ---------- */

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
  const doc = normalizeOnCreate(pick(body, CREATE_FIELDS));
  await db.collection("bookings").insertOne(doc);
  if (hasMaterialized()) await refreshOne(doc._id);
  return doc;
}

/**
 * replace/patch: solo modifica campos MUTABLES.
 * Usa findOneAndUpdate con returnDocument:'after' y includeResultMetadata:true.
 * Si por alguna razón value viene null pero updatedExisting=true, hace un GET de respaldo
 * para evitar el 404 aunque se haya escrito.
 */
export async function replace(id, body) {
  ensureNoImmutable(body);

  const allowed = {};
  for (const k of Object.keys(body)) if (MUTABLE_FIELDS.has(k)) allowed[k] = body[k];
  const $set = normalizeForPatch(allowed);

  const db = getDb();
  const opts = {
    returnDocument: "after",
    upsert: false,
    includeResultMetadata: true, // <- importante para poder inspeccionar updatedExisting
  };

  const r = await db.collection("bookings").findOneAndUpdate({ _id: id }, { $set }, opts);

  let doc = r.value || null;
  // Fallback: si actualizó pero r.value es null (driver/metadatos), leemos el doc
  if (!doc && r?.lastErrorObject?.updatedExisting) {
    doc = await db.collection("bookings").findOne({ _id: id });
  }

  if (!doc) return null;

  if (hasMaterialized()) await refreshOne(id);
  return doc;
}

export async function patch(id, body) {
  return replace(id, body);
}

export async function remove(id) {
  const db = getDb();
  const r = await db.collection("bookings").deleteOne({ _id: id });
  if (hasMaterialized()) await db.collection("bookings_mat").deleteOne({ _id: id });
  return r.deletedCount === 1;
}

/** ---------- Soporte a materialización ---------- */
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
