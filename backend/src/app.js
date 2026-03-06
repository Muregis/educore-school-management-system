import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import studentsRoutes from "./routes/students.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import communicationRoutes from "./routes/communication.routes.js";
import integrationsRoutes from "./routes/integrations.routes.js";
import disciplineRoutes from "./routes/discipline.routes.js";
import transportRoutes from "./routes/transport.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import { errorHandler } from "./middleware/error.js";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/communication", communicationRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/discipline", disciplineRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/settings", settingsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);

export default app;
