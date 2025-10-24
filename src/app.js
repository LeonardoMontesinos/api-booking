// app.js
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/booking.routes.js";
import { mountSwagger } from "./docs/swagger.js";

const app = express();

// 1) Helmet sin CSP global (muy importante)
app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

// 2) CSP SOLO para /docs (permite inline scripts/styles)
const docsCSP = helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "img-src": ["'self'", "data:", "https:"],
    "style-src": ["'self'", "https:", "'unsafe-inline'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    // opcional, por si tu proxy añade esta directiva:
    "script-src-attr": ["'unsafe-inline'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'self'"],
    // la directiva siguiente puede omitirse si tu entorno no la necesita
    "upgrade-insecure-requests": [],
  },
});

// Aplícalo antes de montar Swagger
app.use("/docs", docsCSP);

// 3) Swagger (carga por URL, más robusto)
mountSwagger(app);

// 4) Rutas de negocio
app.use(routes);

// 5) 404
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

export default app;
