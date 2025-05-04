import express from "express";

const createRouter = (conversationController, localLLMController) => {
  const router = express.Router();

  // Start a new conversation
  router.post("/start", async (req, res) => {
    try {
      console.log("Received request to start a new conversation");

      const scenarioId = conversationController.startNewConversation(req.body);
      console.log(`Conversation started with ID: ${scenarioId}`);
      if (scenarioId) {
        return res.status(201).json({ message: "Conversation started" });
      } else {
        return res.status(500).json({ error: "Failed to start conversation" });
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      return res
        .status(500)
        .json({ error: error.message || "Failed to start conversation" });
    }
  });

  router.get("/test", async (req, res) => {
    try {
      return res.status(200).json("test");
    } catch (error) {
      console.error("Error testing:", error);
      return res.status(500).json({ error: error.message || "Failed to test" });
    }
  });

  return router;
};

export default createRouter;
