import cors from "cors";
import express from "express";
import { createApiRouter } from "./http/routes.js";
import { ShipShapeService } from "./services/shipshapeService.js";
import { createPersistentStore } from "./storage/persistentStore.js";

export function createApp() {
  const app = express();
  const store = createPersistentStore();
  const service = new ShipShapeService(store);

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createApiRouter(service));

  return app;
}
