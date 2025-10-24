// src/app.js
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/booking.routes.js";
import { mountSwagger } from "./docs/swagger.js";

const app = express();

// Middleware básico
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

// Rutas de la API
app.use(routes);

// Configuración de Swagger
mountSwagger(app);

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

export default app;
