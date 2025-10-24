import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/booking.routes.js";
import { mountSwagger } from "./docs/swagger.js";

const app = express();

// Helmet global
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

// CSP específico para /docs: permite inline scripts y estilos SOLO ahí
app.use("/docs", (req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "style-src 'self' https: 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ")
  );
  next();
});

// Swagger antes del 404
mountSwagger(app);

// Rutas del API
app.use(routes);

// 404
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

export default app;
