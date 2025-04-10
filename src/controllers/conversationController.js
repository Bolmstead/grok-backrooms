import AnthropicService from "../services/AnthropicService.js";
import OpenAIService from "../services/OpenAIService.js";
import Message from "../models/Message.js";
import { v4 as uuidv4 } from "uuid";
import { servicePrompts, delayBetweenMessages } from "../constants.js";

const Service = AnthropicService;

class ConversationController {
  constructor(io) {
    this.io = io;
    this.grok1Context = [];
    this.grok2Context = [];
    this.isRunning = false;
  }

  async startNewConversation() {
    // Initialize conversation contexts for both Groks

    console.log(`New conversation started`);
    const conversationHistory = await this.getConversationHistory();
    console.log(
      "🚀 ~ ConversationController ~ startNewConversation ~ conversationHistory:",
      conversationHistory
    );
    if (conversationHistory.length > 0) {
      this.grok1Context = conversationHistory.map((message) => ({
        role: message.sender === "grok1" ? "assistant" : "user",
        content: message.content,
      }));
      this.grok2Context = conversationHistory.map((message) => ({
        role: message.sender === "grok2" ? "assistant" : "user",
        content: message.content,
      }));
    } else {
      this.grok1Context = [
        {
          role: "user",
          content: "Let's begin.",
        },
      ];
      this.grok2Context = [
        {
          role: "assistant",
          content: "Let's begin.",
        },
      ];
    }
    this.isRunning = true;

    this.io.emit("conversationStarted", {});

    // Start the conversation loop
    this.continueConversation();

    return;
  }

  async continueConversation() {
    if (!this.isRunning) return;

    try {
      // Keep only the last 10 messages for context
      this.grok1Context = this.grok1Context.slice(-10);

      this.grok2Context = this.grok2Context.slice(-10);

      // Grok1 generates a response
      console.log("Grok #1 preparing its message...");
      console.log("Grok #1 context: ", this.grok1Context);
      const grok1Response = await Service.sendMessage(
        this.grok1Context,
        servicePrompts.backroomsGrok1
      );

      // Add Grok1's response to both contexts
      // Update grok1Context array
      this.grok1Context.push({
        role: "assistant",
        content: grok1Response,
      });
      this.grok2Context.push({
        role: "user",
        content: grok1Response,
      });

      // Save Grok1's message to the database
      const grok1Message = new Message({
        content: grok1Response,
        sender: "grok1",
      });
      await grok1Message.save();

      // Emit the message to clients
      console.log(`Grok #1 response: ${grok1Response}`);
      this.io.emit("newMessage", {
        message: {
          content: grok1Message.content,
          sender: "grok1",
          timestamp: grok1Message.timestamp,
        },
      });

      // Wait a bit before Grok2 responds
      setTimeout(async () => {
        // Grok2 generates a response
        console.log("Grok #2 preparing its message...");
        console.log("Grok #2 context: ", this.grok2Context);
        const grok2Response = await Service.sendMessage(
          this.grok2Context,
          servicePrompts.backroomsGrok2
        );

        // Add Grok2's response to both contexts
        this.grok1Context.push({
          role: "user",
          content: grok2Response,
        });
        this.grok2Context.push({
          role: "assistant",
          content: grok2Response,
        });

        // Save Grok2's message to the database
        const grok2Message = new Message({
          content: grok2Response,
          sender: "grok2",
        });
        await grok2Message.save();

        // Emit the message to clients
        console.log(`Grok #2 response: ${grok2Response}`);
        this.io.emit("newMessage", {
          message: {
            content: grok2Message.content,
            sender: "grok2",
            timestamp: grok2Message.timestamp,
          },
        });

        // Continue the conversation after a delay
        setTimeout(() => {
          this.continueConversation();
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
        this.continueConversation();
      }, delayBetweenMessages);
    }
  }

  async getConversationHistory() {
    try {
      const messages = await Message.find().sort({ timestamp: 1 }).limit(10);
      return messages;
    } catch (error) {
      console.error("Error fetching conversation history:", error);
      throw error;
    }
  }
}

export default ConversationController;
