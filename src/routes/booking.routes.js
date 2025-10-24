import { Router } from "express";
import * as ctrl from "../controller/booking.controller.js";

const router = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Healthcheck de la API y conexión a MongoDB
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       500:
 *         description: Error de conexión a la DB
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/health", ctrl.health);

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: Listar bookings
 *     tags: [Bookings]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, CANCELLED, REFUNDED]
 *       - in: query
 *         name: movie_id
 *         schema: { type: string }
 *       - in: query
 *         name: cinema_id
 *         schema: { type: string }
 *       - in: query
 *         name: showtime_id
 *         schema: { type: string }
 *       - in: query
 *         name: user_id
 *         schema: { type: string }
 *       - in: query
 *         name: payment_method
 *         schema:
 *           type: string
 *           enum: [card, cash, yape, plin, stripe]
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [web, mobile, kiosk, partner]
 *       - in: query
 *         name: email
 *         schema: { type: string, format: email }
 *       - in: query
 *         name: date_from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: date_to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: sort
 *         schema: { type: string, example: "-created_at_dt" }
 *     responses:
 *       200:
 *         description: Lista paginada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 50 }
 *                 count: { type: integer, example: 2 }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Booking'
 */
router.get("/bookings", ctrl.list);

/**
 * @swagger
 * /bookings:
 *   post:
 *     summary: Crear booking
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Booking'
 *           examples:
 *             ejemplo:
 *               value:
 *                 _id: "b-001"
 *                 showtime_id: "s-100"
 *                 movie_id: "m-100"
 *                 cinema_id: "c-200"
 *                 sala_id: "room-7"
 *                 sala_number: 7
 *                 seats:
 *                   - seat_row: "A"
 *                     seat_number: 10
 *                   - seat_row: "A"
 *                     seat_number: 11
 *                 user:
 *                   user_id: "u-123"
 *                   name: "Luciana"
 *                   email: "l@x.com"
 *                 payment_method: "yape"
 *                 source: "web"
 *                 status: "CONFIRMED"
 *                 price_total: 32.5
 *                 currency: "PEN"
 *     responses:
 *       201:
 *         description: Creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Validación fallida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflicto (ID duplicado o asiento ya confirmado)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/bookings", ctrl.create);

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     summary: Obtener booking por ID
 *     tags: [Bookings]
 *     parameters:
 *       - $ref: '#/components/parameters/BookingId'
 *     responses:
 *       200:
 *         description: Ok
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       404:
 *         description: No encontrado
 */
router.get("/bookings/:id", ctrl.get);

/**
 * @swagger
 * /bookings/{id}:
 *   patch:
 *     summary: Actualizar parcialmente (solo campos mutables)
 *     tags: [Bookings]
 *     parameters:
 *       - $ref: '#/components/parameters/BookingId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: >
 *               Campos mutables: seats, user, payment_method, source, status, price_total, currency.
 *     responses:
 *       200:
 *         description: Actualizado
 *       400:
 *         description: Validación fallida
 *       404:
 *         description: No encontrado
 *       409:
 *         description: Conflicto de asiento/ID
 */
router.patch("/bookings/:id", ctrl.patch);

/**
 * @swagger
 * /bookings/{id}:
 *   put:
 *     summary: Reemplazo lógico (solo campos mutables)
 *     tags: [Bookings]
 *     parameters:
 *       - $ref: '#/components/parameters/BookingId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: >
 *               Campos mutables: seats, user, payment_method, source, status, price_total, currency.
 *     responses:
 *       200:
 *         description: Reemplazado
 *       400:
 *         description: Validación fallida
 *       404:
 *         description: No encontrado
 *       409:
 *         description: Conflicto de asiento/ID
 */
router.put("/bookings/:id", ctrl.replace);

/**
 * @swagger
 * /bookings/{id}:
 *   delete:
 *     summary: Eliminar booking
 *     tags: [Bookings]
 *     parameters:
 *       - $ref: '#/components/parameters/BookingId'
 *     responses:
 *       204:
 *         description: Eliminado
 *       404:
 *         description: No encontrado
 */
router.delete("/bookings/:id", ctrl.remove);

export default router;
