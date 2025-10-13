import { Router } from "express";
import * as ctrl from "../controller/booking.controller.js";

const router = Router();

router.get("/health", ctrl.health);

router.get("/bookings", ctrl.list);
router.post("/bookings", ctrl.create);

router.get("/bookings/:id", ctrl.get);
router.put("/bookings/:id", ctrl.replace);
router.patch("/bookings/:id", ctrl.patch);
router.delete("/bookings/:id", ctrl.remove);

export default router;
