import AnthropicService from "../services/AnthropicService.js";
import OpenAIService from "../services/OpenAIService.js";
import Message from "../models/Message.js";
import { v4 as uuidv4 } from "uuid";
import { servicePrompts, delayBetweenMessages } from "../constants.js";

const Service = AnthropicService;

class ConversationController {
  constructor(io) {
    this.io = io;
    this.activeConversations = new Map();
  }

  async startNewConversation() {
    const conversationId = uuidv4();

    // Initialize conversation contexts for both Groks
    const grok1Context = [
      {
        role: "user",
        content: "Let's begin.",
      },
    ];

    const grok2Context = [];

    this.activeConversations.set(conversationId, {
      grok1Context,
      grok2Context,
      isRunning: true,
    });

    console.log(`New conversation started with ID: ${conversationId}`);
    this.io.emit("conversationStarted", { conversationId });

    // Start the conversation loop
    this.continueConversation(conversationId);

    return conversationId;
  }

  async stopConversation(conversationId) {
    const conversation = this.activeConversations.get(conversationId);
    if (conversation) {
      conversation.isRunning = false;
      console.log(`Conversation ${conversationId} stopped`);
      this.io.emit("conversationStopped", { conversationId });
      return true;
    }
    return false;
  }

  async continueConversation(conversationId) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation || !conversation.isRunning) return;

    try {
      // Keep only the last 10 messages for context
      const grok1Context = conversation.grok1Context.slice(-10);

      const grok2Context = conversation.grok2Context.slice(-10);

      // Grok1 generates a response
      console.log("Grok #1 preparing its message...");
      console.log("Grok #1 context: ", grok1Context);
      const grok1Response = await Service.sendMessage(
        grok1Context,
        servicePrompts.backroomsGrok1
      );

      // Add Grok1's response to both contexts
      conversation.grok1Context.push({
        role: "assistant",
        content: grok1Response,
      });
      conversation.grok2Context.push({ role: "user", content: grok1Response });

      // Save Grok1's message to the database
      const grok1Message = new Message({
        content: grok1Response,
        sender: "grok1",
        conversationId,
      });
      await grok1Message.save();

      // Emit the message to clients
      console.log(`Grok #1: ${grok1Response}`);
      this.io.emit("newMessage", {
        conversationId,
        message: {
          content: grok1Response,
          sender: "grok1",
          timestamp: grok1Message.timestamp,
        },
      });

      // Wait a bit before Grok2 responds
      setTimeout(async () => {
        if (!this.activeConversations.get(conversationId)?.isRunning) return;

        // Grok2 generates a response
        console.log("Grok #2 preparing its message...");
        console.log("Grok #2 context: ", grok2Context);
        const grok2Response = await Service.sendMessage(
          grok2Context,
          servicePrompts.backroomsGrok2
        );

        // Add Grok2's response to both contexts
        conversation.grok1Context.push({
          role: "user",
          content: grok2Response,
        });
        conversation.grok2Context.push({
          role: "assistant",
          content: grok2Response,
        });

        // Save Grok2's message to the database
        const grok2Message = new Message({
          content: grok2Response,
          sender: "grok2",
          conversationId,
        });
        await grok2Message.save();

        // Emit the message to clients
        console.log(`Grok #2: ${grok2Response}`);
        this.io.emit("newMessage", {
          conversationId,
          message: {
            content: grok2Response,
            sender: "grok2",
            timestamp: grok2Message.timestamp,
          },
        });

        // Continue the conversation after a delay
        setTimeout(() => {
          this.continueConversation(conversationId);
        }, delayBetweenMessages);
      }, delayBetweenMessages);
    } catch (error) {
      console.error("Error in conversation:", error);
      this.io.emit("conversationError", {
        conversationId,
        error: error.message,
      });

      // Try to continue after an error with a delay
      setTimeout(() => {
        this.continueConversation(conversationId);
      }, 5000);
    }
  }

  async getConversationHistory(conversationId) {
    try {
      const messages = await Message.find({ conversationId })
        .sort({ timestamp: 1 })
        .lean();
      return messages;
    } catch (error) {
      console.error("Error fetching conversation history:", error);
      throw error;
    }
  }
}

export default ConversationController;
