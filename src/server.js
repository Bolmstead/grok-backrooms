import dotenv from "dotenv";
import express from "express";
import http from "http";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import custom modules
import ConversationController from "./controllers/conversationController.js";
import createRouter from "./routes/conversationRoutes.js";

// Load environment variables
dotenv.config();

// Set up Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Initialize the conversation controller with socket.io
const conversationController = new ConversationController();

// Set up routes
app.use("/conversations", createRouter(conversationController));

// Start the server
const PORT = process.env.PORT || 6969;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
