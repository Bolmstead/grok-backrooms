import Message from "../models/Message.js";
import Scenario from "../models/Scenario.js";
import sendOpenAIMessage from "../services/sendOpenAIMessage.js";
import OpenAI from "openai";
import {
  servicePrompts,
  delayBetweenMessages,
  backroomIds,
} from "../constants.js";

class ConversationController {
  constructor(io) {
    console.log("🎮 Initializing Conversation Controller...");
    this.io = io;
    this.ai1Context = [];
    this.ai2Context = [];
    this.isRunning = false;
    this.ai1Service = null;
    this.ai2Service = null;
    this.scenario = null;
  }

  async startNewConversation(scenario) {
    console.log("🚀 Starting new conversation with scenario:", scenario);
    // Initialize conversation contexts for both Groks
    try {
      this.isRunning = true;
      const { scenarioId } = scenario;
      console.log("📝 Processing scenario ID:", scenarioId);
      let scenarioInDB;
      console.log(`💫 New conversation initialized!`);
      scenarioInDB = await Scenario.findOne({
        scenarioId,
      });
      if (!scenarioInDB) {
        console.log("🆕 Creating new scenario in database...");
        scenarioInDB = await Scenario.create(scenario);
      }
      this.scenario = scenarioInDB;
      const conversationHistory = await this.getConversationHistory(
        scenarioInDB
      );
      console.log("📚 Retrieved conversation history:", conversationHistory);
      if (conversationHistory.length > 0) {
        console.log("🔄 Loading existing conversation context...");
        this.ai1Context = conversationHistory.map((message) => ({
          role: message.messageCreatedBy === "ai1" ? "user" : "assistant",
          content: message.content,
        }));
        this.ai2Context = conversationHistory.map((message) => ({
          role: message.messageCreatedBy === "ai2" ? "user" : "assistant",
          content: message.content,
        }));
      } else {
        console.log("🌟 Setting up fresh conversation context...");
        this.ai1Context = scenarioInDB.startingContextAI1;
        this.ai2Context = scenarioInDB.startingContextAI2;
        this.isRunning = true;
      }
      this.io.emit("conversationStarted", {});

      let ai1APIKey, ai2APIKey, ai1BaseURL, ai2BaseURL;

      console.log("🔑 Configuring API settings...");
      if (scenarioInDB.ai1Model.includes("grok")) {
        ai1APIKey = process.env.XAI_API_KEY;
        ai1BaseURL = "https://api.x.ai/v1";
      } else if (scenarioInDB.ai1Model.includes("claude")) {
        ai1APIKey = process.env.CLAUDE_API_KEY;
        ai1BaseURL = "https://api.anthropic.com/v1";
      } else if (scenarioInDB.ai1Model.includes("openai")) {
        ai1APIKey = process.env.OPENAI_API_KEY;
        ai1BaseURL = "https://api.openai.com/v1";
      }

      if (scenarioInDB.ai2Model.includes("grok")) {
        ai2APIKey = process.env.XAI_API_KEY;
        ai2BaseURL = "https://api.x.ai/v1";
      } else if (scenarioInDB.ai2Model.includes("claude")) {
        ai2APIKey = process.env.CLAUDE_API_KEY;
        ai2BaseURL = "https://api.anthropic.com/v1";
      } else if (scenarioInDB.ai2Model.includes("openai")) {
        ai2APIKey = process.env.OPENAI_API_KEY;
        ai2BaseURL = "https://api.openai.com/v1";
      }

      console.log("🤖 Initializing AI services...");
      if (ai2APIKey === ai1APIKey) {
        this.ai1Service = new OpenAI({
          apiKey: ai1APIKey,
          baseURL: ai1BaseURL,
        });
        this.ai2Service = this.ai1Service;
      } else {
        this.ai1Service = new OpenAI({
          apiKey: ai1APIKey,
          baseURL: ai1BaseURL,
        });
        this.ai2Service = new OpenAI({
          apiKey: ai2APIKey,
          baseURL: ai2BaseURL,
        });
      }

      console.log("🎯 Starting conversation loop...");
      this.continueConversation();

      return true;
    } catch (error) {
      console.error("❌ Error starting conversation:", error);
      throw error;
    }
  }

  async continueConversation() {
    if (!this.isRunning) {
      console.log("⏸️ Conversation paused");
      return;
    }

    try {
      console.log("🔄 Trimming conversation context...");
      // Keep only the last 10 messages for context
      this.ai1Context = this.ai1Context.slice(-10);
      this.ai2Context = this.ai2Context.slice(-10);

      // ai1 generates a response
      console.log("🤖 AI #1 thinking...");
      console.log("📜 AI #1 context:", this.ai1Context);
      const savedAI1Message = await sendOpenAIMessage(
        "ai1",
        this.ai1Context,
        this.scenario
      );

      console.log("💬 Adding AI #1's response to context...");
      // Add ai1's response to both contexts
      this.ai1Context.push({
        role: "assistant",
        content: savedAI1Message.content,
      });
      this.ai2Context.push({
        role: "user",
        content: savedAI1Message.content,
      });

      console.log(`📢 AI #1 says: ${savedAI1Message.content}`);
      this.io.emit("newMessage", {
        ...savedAI1Message._doc,
      });

      setTimeout(async () => {
        console.log("🤖 AI #2 thinking...");
        console.log("📜 AI #2 context:", this.ai2Context);
        const savedAI2Message = await sendOpenAIMessage(
          "ai2",
          this.ai2Context,
          this.scenario
        );

        console.log("💬 Adding AI #2's response to context...");
        this.ai1Context.push({
          role: "user",
          content: savedAI2Message.content,
        });
        this.ai2Context.push({
          role: "assistant",
          content: savedAI2Message.content,
        });

        console.log(`📢 AI #2 says: ${savedAI2Message.content}`);
        this.io.emit("newMessage", {
          ...savedAI2Message._doc,
        });

        console.log("⏳ Waiting before next exchange...");
        setTimeout(() => {
          this.continueConversation();
        }, delayBetweenMessages);
      }, delayBetweenMessages);
    } catch (error) {
      console.error("❌ Conversation error:", error);
      this.io.emit("conversationError", {
        error: error.message,
      });

      console.log("🔄 Attempting to recover from error...");
      setTimeout(() => {
        this.continueConversation();
      }, delayBetweenMessages);
    }
  }

  async getConversationHistory(scenario) {
    try {
      console.log("📚 Fetching conversation history...");
      const messages = await Message.find({
        scenario,
        messageCreatedBy: { $ne: "status" },
      })
        .sort({ timestamp: 1 })
        .limit(5);
      console.log(`✨ Found ${messages.length} historical messages`);
      return messages;
    } catch (error) {
      console.error("❌ Error fetching conversation history:", error);
      throw error;
    }
  }
}

export default ConversationController;
