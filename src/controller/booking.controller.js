//bookingcontroller
import * as Bookings from "../models/booking.model.js";

export const health = async (req, res) => {
    try {
        await req.app.locals.db.command({ ping: 1 });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
};

export const list = async (req, res) => {
    try {
        const result = await Bookings.list(req.query);
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

export const get = async (req, res) => {
    try {
        const doc = await Bookings.getById(req.params.id);
        if (!doc) return res.status(404).json({ error: "Not found" });
        res.json(doc);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

export const create = async (req, res) => {
    try {
        const created = await Bookings.create(req.body);
        res.status(201).json(created);
    } catch (e) {
        if (e?.code === 11000) {
            return res.status(409).json({ error: "conflict", detail: "duplicate key", key: e.keyValue });
        }
        res.status(400).json({ error: e.message });
    }
};

export const replace = async (req, res) => {
    try {
        const doc = await Bookings.replace(req.params.id, req.body);
        if (!doc) return res.status(404).json({ error: "Not found" });
        res.json(doc);
    } catch (e) {
        if (e?.code === 11000) {
            return res.status(409).json({ error: "conflict", detail: "duplicate key", key: e.keyValue });
        }
        res.status(400).json({ error: e.message });
    }
};

export const patch = async (req, res) => {
    try {
        const doc = await Bookings.patch(req.params.id, req.body);
        if (!doc) return res.status(404).json({ error: "Not found" });
        res.json(doc);
    } catch (e) {
        if (e?.code === 11000) {
            return res.status(409).json({ error: "conflict", detail: "duplicate key", key: e.keyValue });
        }
        res.status(400).json({ error: e.message });
    }
};

export const remove = async (req, res) => {
    try {
        const ok = await Bookings.remove(req.params.id);
        if (!ok) return res.status(404).json({ error: "Not found" });
        res.status(204).send();
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};
