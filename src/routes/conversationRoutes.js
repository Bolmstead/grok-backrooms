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

  // Stop an active conversation
  router.post("/stop/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      console.log(`Received request to stop conversation: ${conversationId}`);

      const stopped = await conversationController.stopConversation(
        conversationId
      );

      if (stopped) {
        console.log(`Successfully stopped conversation: ${conversationId}`);
        return res.status(200).json({ message: "Conversation stopped" });
      } else {
        console.log(`Conversation not found: ${conversationId}`);
        return res.status(404).json({ error: "Conversation not found" });
      }
    } catch (error) {
      console.error("Error stopping conversation:", error);
      return res
        .status(500)
        .json({ error: error.message || "Failed to stop conversation" });
    }
  });

  // Get conversation history
  router.get("/:conversationId/history", async (req, res) => {
    try {
      const { conversationId } = req.params;
      console.log(`Fetching history for conversation: ${conversationId}`);

      const history = await conversationController.getConversationHistory(
        conversationId
      );
      console.log(
        `Found ${history.length} messages for conversation: ${conversationId}`
      );

      return res.status(200).json({ conversationId, messages: history });
    } catch (error) {
      console.error("Error fetching conversation history:", error);
      return res.status(500).json({
        error: error.message || "Failed to fetch conversation history",
      });
    }
  });

  return router;
};

export default createRouter;
