import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/booking.routes.js";
import { mountSwagger } from "./docs/swagger.js";

const app = express();

// Helmet global (sin CSP explícito)
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

// CSP permisivo SOLO para /docs (si tu proxy añade CSP, esto ayuda igual)
const docsCSP = helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "https:"],
  },
});
app.use("/docs", docsCSP);

// Swagger antes del 404
mountSwagger(app);

// Rutas de negocio
app.use(routes);

// 404
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

export default app;
