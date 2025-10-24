// docs/swagger.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Schemas (idénticos a los tuyos) ---
const SeatSchema = {
  type: "object",
  required: ["seat_row", "seat_number"],
  properties: {
    seat_row: { type: "string", example: "A" },
    seat_number: { type: "integer", example: 10 },
  },
};

const UserSchema = {
  type: "object",
  required: ["user_id", "name", "email"],
  properties: {
    user_id: { type: "string", example: "u-123" },
    name: { type: "string", example: "Luciana" },
    email: { type: "string", format: "email", example: "l@x.com" },
  },
};

const BookingSchema = {
  type: "object",
  required: ["_id", "showtime_id", "movie_id", "status", "price_total", "currency"],
  properties: {
    _id: { type: "string", example: "b-001" },
    showtime_id: { type: "string", example: "s-100" },
    movie_id: { type: "string", example: "m-100" },
    cinema_id: { type: "string", example: "c-200" },
    sala_id: { type: "string", example: "room-7" },
    sala_number: { type: "integer", example: 7 },
    seats: { type: "array", items: SeatSchema },
    user: UserSchema,
    payment_method: {
      type: "string",
      nullable: true,
      enum: ["card", "cash", "yape", "plin", "stripe"],
      example: "yape",
    },
    source: {
      type: "string",
      nullable: true,
      enum: ["web", "mobile", "kiosk", "partner"],
      example: "web",
    },
    status: {
      type: "string",
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "REFUNDED"],
      example: "CONFIRMED",
    },
    price_total: { type: "number", example: 32.5 },
    currency: { type: "string", example: "PEN" },
    created_at: { type: "string", format: "date-time", nullable: true, example: "2025-10-14T20:30:00.000Z" },
  },
};

const ErrorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
    detail: { type: "string" },
    key: { type: "object" },
  },
};

// Globs ABSOLUTOS: aseguran que swagger-jsdoc encuentre tus rutas en cualquier entorno
const apiFiles = [
  path.join(process.cwd(), "src/routes/**/*.js"),
  path.join(__dirname, "../routes/**/*.js"),
  path.join(__dirname, "../../src/routes/**/*.js"),
];

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: { title: "Bookings API", version: "1.0.0", description: "API para gestión de boletos (bookings)." },
    servers: [{ url: "http://localhost:3000" }],
    tags: [{ name: "System" }, { name: "Bookings" }],
    components: {
      schemas: { Seat: SeatSchema, User: UserSchema, Booking: BookingSchema, Error: ErrorSchema },
      parameters: {
        BookingId: {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "ID del booking",
        },
      },
    },
  },
  apis: apiFiles,
  failOnErrors: true, // si algo está mal, lo verás en consola
});

// Logs útiles para confirmar que ya hay paths
console.log("[swagger] apis globs:", apiFiles);
console.log("[swagger] paths encontrados:", Object.keys(swaggerSpec.paths || {}));

export function mountSwagger(app) {
  // JSON (lo consume el UI)
  app.get("/docs.json", (_req, res) => res.json(swaggerSpec));

  // UI que carga la spec por URL (más robusto)
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(null, {
      explorer: true,
      swaggerOptions: { url: "/docs.json" },
    })
  );
}
