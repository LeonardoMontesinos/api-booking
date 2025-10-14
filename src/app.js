import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/booking.routes.js";
import { mountSwagger } from "./docs/swagger.js"; 

const app = express();
app.use(helmet());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("combined"));

// Swagger antes del 404
mountSwagger(app);

app.use(routes);

app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

export default app;
