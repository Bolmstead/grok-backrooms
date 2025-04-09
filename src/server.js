import dotenv from "dotenv";
import express from "express";
import http from "http";
import { Server } from "socket.io";
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
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Initialize the conversation controller with socket.io
const conversationController = new ConversationController(io);

// Set up routes
app.use("/api/conversations", createRouter(conversationController));

// Serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
