import express from "express";

const createRouter = (conversationController) => {
  const router = express.Router();

  // Start a new conversation
  router.post("/start", async (req, res) => {
    try {
      console.log("Received request to start a new conversation");
      const conversationId = conversationController.startNewConversation();
      console.log(`Conversation started with ID: ${conversationId}`);
      return res
        .status(201)
        .json({ conversationId, message: "Conversation started" });
    } catch (error) {
      console.error("Error starting conversation:", error);
      return res
        .status(500)
        .json({ error: error.message || "Failed to start conversation" });
    }
  });

  return router;
};

export default createRouter;
