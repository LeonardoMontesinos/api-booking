// src/app.js
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/booking.routes.js";
import expressOasGenerator from "express-oas-generator";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// añade en app.js (además de lo anterior o en vez de rapidoc)
const swaggerUiDist = path.dirname(require.resolve("swagger-ui-dist"));
const swaggerInitJs = path.join(process.cwd(), "swagger-init.js");

// 1) archivos estáticos del UI (solo 'self')
app.use("/swagger-ui", express.static(swaggerUiDist));

// 2) init SIN inline (crear swagger-init.js en tu proyecto)
app.get("/swagger", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html>
<head>
  <link rel="stylesheet" href="/swagger-ui/swagger-ui.css"/>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/swagger-ui/swagger-ui-bundle.js"></script>
  <script src="/swagger-ui/swagger-ui-standalone-preset.js"></script>
  <script src="/swagger-init.js"></script>
</body>
</html>`);
});

// 3) swagger-init.js (archivo, no inline):
// window.onload = () => { SwaggerUIBundle({ url: '/docs.json', dom_id: '#swagger-ui' }) }

// Helmet por defecto: permite "script-src 'self'", que es justo lo que usaremos en /docs
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

// --- 1) Inicializa el generador (ANTES de tus rutas) ---
expressOasGenerator.handleResponses(app, {
  specOutputFileBehavior: "RECREATE",     // reescribe openapi.json al iniciar
  swaggerDocumentOptions: {
    openapi: "3.0.3",
    info: {
      title: "Bookings API",
      version: "1.0.0",
      description: "API para gestión de boletos (bookings).",
    },
    servers: [{ url: process.env.PUBLIC_BASE_URL || "http://localhost:3000" }],
    tags: [{ name: "System" }, { name: "Bookings" }],
    // Puedes omitir components; el generador infiere cosas desde requests/responses reales
  },
});

// --- 2) Tus rutas reales ---
app.use(routes);

// --- 3) Cierra el generador (DESPUÉS de las rutas) ---
expressOasGenerator.handleRequests();

// --- 4) Servir el JSON del OpenAPI generado ---
const OPENAPI_PATH = path.join(process.cwd(), "openapi.json");
app.get("/docs.json", (req, res) => {
  if (fs.existsSync(OPENAPI_PATH)) {
    return res.sendFile(OPENAPI_PATH);
  }
  res.status(503).json({
    error: "El spec aún no se ha generado. Invoca algún endpoint (p. ej. /health) y recarga.",
  });
});

// --- 5) UI con RapiDoc SIN inline scripts (compatible con CSP 'self') ---
const rapidocJs = require.resolve("rapidoc/dist/rapidoc-min.js");

app.get("/docs", (_req, res) => {
  // No hay <script> inline, solo cargamos /docs/rapidoc-min.js (mismo host → 'self')
  res.type("html").send(`<!doctype html>
<html>
<head><meta charset="utf-8"/><title>API Docs</title></head>
<body style="margin:0;background:#fff;">
  <rapi-doc spec-url="/docs.json" render-style="read" show-header schema-style="table"></rapi-doc>
  <script src="/docs/rapidoc-min.js"></script>
</body>
</html>`);
});

app.get("/docs/rapidoc-min.js", (_req, res) => res.sendFile(rapidocJs));

// 404
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

export default app;
