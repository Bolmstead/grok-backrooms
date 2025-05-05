import dotenv from "dotenv";
import ollama from "ollama";
import Message from "../models/Message.js";
import {
  coinCreationPrompt,
  numOfPreviousConversations,
} from "../constants.js";
dotenv.config();
import { sendTweet } from "../helpers/twitter.js";
import { sendTeleMessage } from "../helpers/telegram.js";
// Configure the Ollama client (default connects to localhost:11434)
// const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
// const ollamaClient = new ollama.Client({ host: OLLAMA_HOST });

async function sendOllamaMessage(receiver, messages, scenario) {
  try {
    console.log("🎯 Starting Ollama message processing for", receiver);
    if (
      receiver !== "status" &&
      receiver !== "ai1" &&
      receiver !== "ai2" &&
      receiver !== "user"
    ) {
      console.error("❌ Invalid receiver:", receiver);
      throw new Error("Invalid receiver");
    }

    const {
      maxTokens,
      systemMessageAI1,
      systemMessageAI2,
      ai1Model,
      ai2Model,
      ai1Temperature,
      ai2Temperature,
    } = scenario;
    let systemPrompt, model, temperature, coinCreationRequest;

    if (receiver === "ai2") {
      console.log("🤖 Configuring for AI2");
      systemPrompt = systemMessageAI2;
      model = ai2Model;
      temperature = ai2Temperature;
    } else if (receiver === "ai1") {
      console.log("🤖 Configuring for AI1");
      systemPrompt = systemMessageAI1;
      model = ai1Model;
      temperature = ai1Temperature;
    }

    console.log("📝 Processing message array");
    const messageArray = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => {
        return {
          role: msg.role,
          content: msg.content,
        };
      });

    if (messageArray.length > numOfPreviousConversations) {
      console.log(
        `✂️ Trimming message array to last ${numOfPreviousConversations} messages`
      );
      messageArray.splice(0, messageArray.length - numOfPreviousConversations);
    }

    if (scenario.createMemeCoins) {
      console.log("🪙 Adding coin creation prompt to system message");
      systemPrompt = systemPrompt + `\n${coinCreationPrompt}`;
    }

    const systemMessage = { role: "system", content: systemPrompt };
    messageArray.unshift(systemMessage);

    const chatObject = {
      model,
      messages: messageArray,
      stream: false,
    };

    console.log("🧞‍♂️🧞‍♂️🧞‍♂️ chatObject:: ", chatObject);
    console.log("🚀 Sending chat request to Ollama");

    // Using the Ollama SDK to send the chat request
    const response = await ollama.chat({
      model,
      messages: messageArray,
      stream: false,
    });

    const responseMessage = response.message.content;
    console.log("📨 Received response from Ollama");

    const dbMessage = new Message({
      scenario,
      content: responseMessage,
      messageCreatedBy: receiver,
      coinCreationRequest: coinCreationRequest,
    });
    console.log(
      "🌈 ~ ollamaService ~ sendOllamaMessage ~ dbMessage.content:",
      dbMessage.content
    );

    console.log("💾 Saving message to database");
    await dbMessage.save();

    await sendTweet(dbMessage);
    await sendTeleMessage(dbMessage);

    return dbMessage;
  } catch (error) {
    console.error("💥 Error in sendOllamaMessage:", error);
    throw error;
  }
}

async function createImage(imageDescription) {
  try {
    console.log("🎨 Starting image creation process");
    // Create a unique filename with timestamp
    const filename = `memecoinImage_${Date.now()}.png`;

    // Define the directory path where images will be saved
    const fs = await import("fs/promises");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const imagesDir = path.resolve(__dirname, "..", "images");
    const imagePath = path.join(imagesDir, filename);

    console.log("📁 Checking images directory");
    // Ensure the images directory exists
    try {
      await fs.access(imagesDir);
      console.log("✅ Images directory exists");
    } catch (err) {
      console.log("📁 Creating images directory");
      await fs.mkdir(imagesDir, { recursive: true });
    }

    console.log(
      "⚠️ Image generation not supported with standard Ollama models"
    );
    throw new Error(
      "Image generation not directly supported with standard Ollama models. Consider using a multimodal model or connecting to a separate image generation service."
    );

    // Once implemented, return the image details
    return {
      path: imagePath,
      filename: filename,
      fullPath: path.join("images", filename),
    };
  } catch (error) {
    console.error("💥 Error in createImage:", error);
    throw error;
  }
}

export { sendOllamaMessage, createImage };
