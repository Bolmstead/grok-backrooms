import OpenAI from "openai";
import dotenv from "dotenv";
import Message from "../models/Message.js";
import Scenario from "../models/Scenario.js";
import { models, coinCreationPrompt } from "../constants.js";
dotenv.config();

// Create a singleton OpenAI instance
console.log("🔑 Initializing OpenAI client...");
const openaiService = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1",
});

const xAIService = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

async function sendOpenAIMessage(receiver, messages, scenario) {
  try {
    console.log("📨 Starting message processing for receiver:", receiver);

    if (
      receiver !== "status" &&
      receiver !== "ai1" &&
      receiver !== "ai2" &&
      receiver !== "user"
    ) {
      console.log("⛔ Invalid receiver detected:", receiver);
      throw new Error("Invalid receiver");
    }

    console.log("📦 Unpacking scenario configuration...");
    const {
      maxTokens,
      systemMessageAI1,
      systemMessageAI2,
      ai1Model,
      ai2Model,
      ai1Temperature,
      ai2Temperature,
    } = scenario;
    let systemPrompt, model, temperature, coinCreationRequest, openai;

    console.log("🎭 Determining AI role and model...");
    if (receiver === "ai2") {
      console.log("🤖 Setting up AI2 configuration");
      systemPrompt = systemMessageAI2;
      model = ai2Model;
      temperature = ai2Temperature;
    } else if (receiver === "ai1") {
      console.log("🦾 Setting up AI1 configuration");
      systemPrompt = systemMessageAI1;
      model = ai1Model;
      temperature = ai1Temperature;
    }

    if (model.includes("grok")) {
      openai = xAIService;
    } else {
      openai = openaiService;
    }

    console.log("🧹 Cleaning message array...");
    const messageArray = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => {
        console.log("🦖 msg:: ", msg);
        console.log("📝 Processing message:", msg.role);
        return {
          role: msg.role,
          content: msg.content,
        };
      });

    console.log("✂️ Trimming conversation history...");
    console.log("👀 messageArray before trimming:: ", messageArray);
    if (messageArray.length > 3) {
      console.log("📚 History exceeds 3 messages, truncating...");
      messageArray.splice(0, messageArray.length - 3);
    }
    console.log("👀 messageArray after trimming:: ", messageArray);

    console.log("🎯 Inserting system message at start");
    const systemMessage = { role: "system", content: systemPrompt };
    messageArray.unshift(systemMessage);
    console.log(
      "🧑🏻‍🦯‍➡️🧑🏻‍🦯‍➡️🧑🏻‍🦯‍➡️🧑🏻‍🦯‍➡️ ~ sendOpenAIMessage ~ systemMessage:",
      systemMessage
    );

    console.log("🚀 Preparing API request with params:", {
      model,
      temperature,
      maxTokens,
    });

    // Add system message about coin creation

    console.log("⏳ Awaiting OpenAI response...");
    const response = await openai.chat.completions.create({
      model,
      messages: messageArray,
      temperature,
      max_tokens: maxTokens,
    });
    console.log("🚀 ~ sendOpenAIMessage ~ response:", response);

    console.log(
      "🚀 ~ sendOpenAIMessage ~ response.choices[0]:",
      response.choices[0]
    );

    const responseMessage = response.choices[0].message.content;
    console.log("💫 Received AI response:", responseMessage);

    console.log("💾 Creating database message entry...");
    const dbMessage = new Message({
      scenario,
      content: responseMessage,
      messageCreatedBy: receiver,
      coinCreationRequest: coinCreationRequest,
    });
    console.log("🤞 ~ sendOpenAIMessage ~ dbMessage:", dbMessage);

    console.log("💽 Saving message to database...");
    await dbMessage.save();

    console.log("✨ Database save successful:", dbMessage);

    return dbMessage;
  } catch (error) {
    console.log("💥 Error encountered in message processing");
    console.error("🚨 Error communicating with xAI API:", error.message);
    if (error.response) {
      console.error("📋 Detailed error response:", error.response.data);
    }
    throw error;
  }
}

export default sendOpenAIMessage;
