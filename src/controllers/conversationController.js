import Message from "../models/Message.js";
import Scenario from "../models/Scenario.js";
import { sendOpenAIMessage, createImage } from "../services/openAIService.js";
import OpenAI from "openai";
import createPumpfunCoin from "../helpers/createPumpfunCoin.js";
import {
  servicePrompts,
  delayBetweenMessages,
  backroomIds,
  numOfPreviousConversations,
} from "../constants.js";
import { sendOllamaMessage } from "../services/ollamaService.js";

class ConversationController {
  constructor(io) {
    console.log("🎭 Initializing ConversationController");
    this.io = io;
    this.ai1Context = [];
    this.ai2Context = [];
    this.isRunning = false;
    this.ai1Service = null;
    this.ai2Service = null;
    this.scenario = null;
    this.coinCreationEnabled = true; // Enable coin creation by default
  }

  async handleCoinCreation(aiName, message) {
    try {
      console.log("💰 Starting coin creation process for", aiName);
      // Extract potential coin information from message content
      const content = message.content || "";

      // Updated regex patterns to handle JSON-like format
      const nameMatch = content.match(/Name:\s*["']?([^"'\n}]+)["']?/);
      const tickerMatch = content.match(/Ticker:\s*["']?([^"'\n}]+)["']?/);
      const descriptionMatch = content.match(
        /Description:\s*["']?([^"'\n}]+)["']?/
      );
      const imageDescriptionMatch = content.match(
        /Image Description:\s*["']?([^"'\n}]+)["']?/
      );

      console.log("🔍 Regex matches:", {
        nameMatch: nameMatch?.[1],
        tickerMatch: tickerMatch?.[1],
        descriptionMatch: descriptionMatch?.[1],
        imageDescriptionMatch: imageDescriptionMatch?.[1],
      });

      // Extract raw values first for logging
      const rawName = nameMatch?.[1]?.trim();
      const rawTicker = tickerMatch?.[1]?.trim();
      const rawDescription = descriptionMatch?.[1]?.trim();
      const rawImageDescription = imageDescriptionMatch?.[1]?.trim();

      console.log("📊 Extracted coin details:", {
        name: rawName,
        ticker: rawTicker,
        description: rawDescription?.substring(0, 50) + "...",
        imageDescription: rawImageDescription?.substring(0, 50) + "...",
      });

      // Extract values, clean them by removing quotes, and trim whitespace
      const cleanValue = (value) => {
        if (!value) return null;
        // Remove quotes, trim whitespace, and normalize newlines
        return value
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/\r?\n\s*/g, " ")
          .trim();
      };

      const name = cleanValue(rawName);
      const ticker = cleanValue(rawTicker);
      const description = cleanValue(rawDescription);
      const imageDescription = cleanValue(rawImageDescription);

      // Check if we have the required fields
      if (!name || !ticker || !description) {
        console.log("❌ Missing required coin information");
        // Create a message informing that coin creation failed due to missing details
        const errorMessage = `
--------------------------------
Memecoin Creation Failed
Required information missing. Please specify Name, Ticker, and Description.
--------------------------------
`;
        const errorMessageDB = new Message({
          scenario: this.scenario,
          messageCreatedBy: aiName,
          content: errorMessage,
        });
        await errorMessageDB.save();
        this.io.emit("newMessage", {
          ...errorMessageDB._doc,
        });
        return { success: false, message: "Missing required coin information" };
      }

      console.log("🎯 Proceeding with coin creation for", name);
      // Use the direct createMemecoin function with extracted parameters
      const result = await createPumpfunCoin({
        name,
        ticker,
        description,
        imageDescription,
      });
      console.log("💰 Coin creation result:", result);

      let newCoinMessage;
      if (result) {
        console.log("✨ Coin creation successful");
        newCoinMessage = `--------------------------------
Memecoin Creation Success
tx signature: ${result}
--------------------------------`;
      } else {
        console.log("💥 Coin creation failed");
        newCoinMessage = `--------------------------------
Memecoin Creation Failed
"Unable to process the memecoin creation request"
--------------------------------`;
      }

      const newCoinMessageDB = new Message({
        scenario: this.scenario,
        messageCreatedBy: aiName,
        content: newCoinMessage,
      });
      await newCoinMessageDB.save();
      this.io.emit("newMessage", {
        ...newCoinMessageDB._doc,
      });
      if (aiName === "ai1") {
        this.ai1Context.push({
          role: "assistant",
          content: newCoinMessageDB.content,
        });
        this.ai2Context.push({
          role: "user",
          content: newCoinMessageDB.content,
        });
      } else {
        this.ai1Context.push({
          role: "user",
          content: newCoinMessageDB.content,
        });
        this.ai2Context.push({
          role: "assistant",
          content: newCoinMessageDB.content,
        });
      }

      return result;
    } catch (error) {
      console.error("🔥 Error in handleCoinCreation:", error);
      this.io.emit("coinCreationError", {
        aiName,
        error: error.message,
      });
      throw error;
    }
  }

  async startNewConversation(scenario) {
    console.log("🎪 Starting new conversation");
    // Initialize conversation contexts for both Groks
    try {
      this.isRunning = true;
      const { scenarioId } = scenario;
      let scenarioInDB;
      scenarioInDB = await Scenario.findOne({
        scenarioId,
      });
      if (!scenarioInDB) {
        console.log("📝 Creating new scenario in database");
        scenarioInDB = await Scenario.create(scenario);
      }
      this.scenario = scenarioInDB;
      const conversationHistory = await this.getConversationHistory(
        scenarioInDB
      );
      console.log(
        "🌀 ~ ConversationController ~ startNewConversation ~ conversationHistory:",
        conversationHistory
      );
      if (conversationHistory.length > 0) {
        console.log("📚 Loading existing conversation history");
        this.ai1Context = conversationHistory.map((message) => ({
          role: message.messageCreatedBy === "ai1" ? "user" : "assistant",
          content: message.content,
        }));
        this.ai2Context = conversationHistory.map((message) => ({
          role: message.messageCreatedBy === "ai2" ? "user" : "assistant",
          content: message.content,
        }));
      } else {
        console.log("🎨 Using initial context from scenario");
        this.ai1Context = scenarioInDB.startingContextAI1;
        this.ai2Context = scenarioInDB.startingContextAI2;
        this.isRunning = true;
      }
      this.io.emit("conversationStarted", { scenarioId, live: true });

      let ai1APIKey, ai2APIKey, ai1BaseURL, ai2BaseURL;

      if (scenarioInDB.ai1Model.includes("grok")) {
        console.log("🤖 Using Grok for AI1");
        ai1APIKey = process.env.XAI_API_KEY;
        ai1BaseURL = "https://api.x.ai/v1";
      } else if (scenarioInDB.ai1Model.includes("claude")) {
        console.log("🧠 Using Claude for AI1");
        ai1APIKey = process.env.CLAUDE_API_KEY;
        ai1BaseURL = "https://api.anthropic.com/v1";
      } else if (scenarioInDB.ai1Model.includes("openai")) {
        console.log("🤖 Using OpenAI for AI1");
        ai1APIKey = process.env.OPENAI_API_KEY;
        ai1BaseURL = "https://api.openai.com/v1";
      }

      if (scenarioInDB.ai2Model.includes("grok")) {
        console.log("🤖 Using Grok for AI2");
        ai2APIKey = process.env.XAI_API_KEY;
        ai2BaseURL = "https://api.x.ai/v1";
      } else if (scenarioInDB.ai2Model.includes("claude")) {
        console.log("🧠 Using Claude for AI2");
        ai2APIKey = process.env.CLAUDE_API_KEY;
        ai2BaseURL = "https://api.anthropic.com/v1";
      } else if (scenarioInDB.ai2Model.includes("openai")) {
        console.log("🤖 Using OpenAI for AI2");
        ai2APIKey = process.env.OPENAI_API_KEY;
        ai2BaseURL = "https://api.openai.com/v1";
      }

      if (
        scenarioInDB.localLLM === false &&
        (scenarioInDB.ai2Model.includes("grok") ||
          scenarioInDB.ai2Model.includes("claude") ||
          scenarioInDB.ai1Model.includes("grok") ||
          scenarioInDB.ai1Model.includes("claude"))
      ) {
        if (ai2APIKey === ai1APIKey) {
          console.log("🔑 Using same API key for both AIs");
          this.ai1Service = new OpenAI({
            apiKey: ai1APIKey,
            baseURL: ai1BaseURL,
          });
          this.ai2Service = this.ai1Service;
        } else {
          console.log("🔑 Using different API keys for AIs");
          this.ai1Service = new OpenAI({
            apiKey: ai1APIKey,
            baseURL: ai1BaseURL,
          });
          this.ai2Service = new OpenAI({
            apiKey: ai2APIKey,
            baseURL: ai2BaseURL,
          });
        }
      }

      this.continueConversation();

      return scenarioInDB.scenarioId;
    } catch (error) {
      console.error("💥 Error in startNewConversation:", error);
      throw error;
    }
  }

  async continueConversation() {
    if (!this.isRunning) {
      console.log("⏸️ Conversation is not running");
      return;
    }

    try {
      console.log("🔄 Continuing conversation");
      // Keep only the last 10 messages for context
      this.ai1Context = this.ai1Context.slice(-numOfPreviousConversations);
      this.ai2Context = this.ai2Context.slice(-numOfPreviousConversations);

      // ai1 generates a response
      let savedAI1Message;
      console.log(
        "🔮 ~ ConversationController ~ continueConversation ~ this.ai1Context:",
        this.ai1Context
      );
      if (this.scenario.localLLM) {
        console.log("🏠 Using local LLM for AI1");
        savedAI1Message = await sendOllamaMessage(
          "ai1",
          this.ai1Context,
          this.scenario
        );
      } else {
        console.log("☁️ Using cloud LLM for AI1");
        savedAI1Message = await sendOpenAIMessage(
          "ai1",
          this.ai1Context,
          this.scenario
        );
      }
      // Add ai1's response to both contexts
      this.ai1Context.push({
        role: "assistant",
        content: savedAI1Message.content,
      });
      this.ai2Context.push({
        role: "user",
        content: savedAI1Message.content,
      });

      this.io.emit("newMessage", {
        ...savedAI1Message._doc,
      });
      // Alternative detection method - check if message content contains coin creation keywords
      if (
        this.coinCreationEnabled &&
        savedAI1Message.content &&
        /\brun createToken.exe\b/i.test(savedAI1Message.content)
      ) {
        console.log("🪙 Detected coin creation request in AI1 message");
        await this.handleCoinCreation("ai1", savedAI1Message);
      }

      setTimeout(async () => {
        let savedAI2Message;
        console.log(
          "🧠 ~ ConversationController ~ continueConversation ~ this.ai2Context:",
          this.ai2Context
        );
        if (this.scenario.localLLM) {
          console.log("🏠 Using local LLM for AI2");
          savedAI2Message = await sendOllamaMessage(
            "ai2",
            this.ai2Context,
            this.scenario
          );
        } else {
          console.log("☁️ Using cloud LLM for AI2");
          savedAI2Message = await sendOpenAIMessage(
            "ai2",
            this.ai2Context,
            this.scenario
          );
        }
        this.ai1Context.push({
          role: "user",
          content: savedAI2Message.content,
        });
        this.ai2Context.push({
          role: "assistant",
          content: savedAI2Message.content,
        });

        this.io.emit("newMessage", {
          ...savedAI2Message._doc,
        });

        // Alternative detection method - check if message content contains coin creation keywords
        if (
          this.coinCreationEnabled &&
          savedAI2Message.content &&
          /\brun createToken.exe\b/i.test(savedAI2Message.content)
        ) {
          console.log("🪙 Detected coin creation request in AI2 message");
          await this.handleCoinCreation("ai2", savedAI2Message);
        }

        setTimeout(() => {
          this.continueConversation();
        }, delayBetweenMessages);
      }, delayBetweenMessages);
    } catch (error) {
      console.error("💥 Error in continueConversation:", error);
      this.io.emit("conversationError", {
        error: error.message,
      });

      setTimeout(() => {
        this.continueConversation();
      }, delayBetweenMessages);
    }
  }

  async getConversationHistory(scenario) {
    try {
      console.log("📜 Fetching conversation history");
      const messages = await Message.find({
        scenario,
        messageCreatedBy: { $ne: "status" },
      })
        .sort({ timestamp: 1 })
        .limit(5);
      console.log("📚 Found", messages.length, "messages in history");
      return messages;
    } catch (error) {
      console.error("💥 Error in getConversationHistory:", error);
      throw error;
    }
  }
}

export default ConversationController;
