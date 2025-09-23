import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import adminRouter from "./routes/admin.routes.js";
import authRouter from "./routes/auth.routes.js";
import userRouter from "./routes/user.routes.js";
import listingRouter from "./routes/listing.route.js";
import notificationsRouter from "./routes/notifications.routes.js";
import commissionsRouter from "./routes/commissions.routes.js";
import dealsRouter from "./routes/deals.routes.js";
import reportRoute from "./routes/report.routes.js";
import chatRoute from "./routes/chat.routes.js";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { swaggerOptions } from "./config/swaggerConfig.js";
import cors from "cors";

// Load env variables
dotenv.config({ quiet: true });
console.log("JWT_SECRET:", process.env.JWT_SECRET);

const app = express();

// Swagger docs setup
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: [process.env.Client_Url ,
   process.env.Admin_Url],
  credentials: true,
}));

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Bims API" });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/user", userRouter);
app.use("/api/listing", listingRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/commissions", commissionsRouter);
app.use("/api/deals", dealsRouter);
app.use("/api/report", reportRoute);
app.use("/api/chat", chatRoute);
// app.use("/uploads", express.static("uploads"));

// Connect to MongoDB only once on cold start
let isConnected = false;

async function connectToDatabase() {
  if (!isConnected) {
    try {
      await mongoose.connect(process.env.MONGO_URL);
      console.log("MongoDB Connected!");
      isConnected = true;
    } catch (err) {
      console.error("MongoDB connection error:", err);
    }
  }
}

// Export the handler for Vercel
export default async function handler(req, res) {
  await connectToDatabase();
  return app(req, res); // Let Express handle the request
}
