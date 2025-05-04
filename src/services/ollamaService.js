import OpenAI from "openai";
import dotenv from "dotenv";
import Message from "../models/Message.js";
import { coinCreationPrompt, models } from "../constants.js";
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
    if (messageArray.length > 2) {
      console.log("📚 History exceeds 2 messages, truncating...");
      messageArray.splice(0, messageArray.length - 2);
    }

    console.log("👀 scenario.createMemeCoins:: ", scenario.createMemeCoins);
    console.log("👀 coinCreationPrompt:: ", coinCreationPrompt);

    if (scenario.createMemeCoins) {
      systemPrompt =
        systemPrompt +
        `
${coinCreationPrompt}`;
    }

    console.log("🏃🏻🏃🏻🏃🏻🏃🏻🏃🏻 systemPrompt:: ", systemPrompt);

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

    console.log("⏳ Awaiting AI response...");
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

async function createImage(imageDescription, imageModel = "openai") {
  try {
    console.log(
      "🎨 Generating image from description using Grok:",
      imageDescription
    );

    // Create a unique filename with timestamp
    const filename = `memecoinImage.png`;

    // Define the directory path where images will be saved
    const fs = await import("fs/promises");
    const path = await import("path");
    const { fileURLToPath } = await import("url");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const imagesDir = path.resolve(__dirname, "..", "images");
    const imagePath = path.join(imagesDir, filename);

    // Ensure the images directory exists
    try {
      await fs.access(imagesDir);
    } catch (err) {
      console.log("📁 Creating images directory");
      await fs.mkdir(imagesDir, { recursive: true });
    }

    let imageData;

    try {
      const openaiResponse = await openaiService.images.generate({
        model: "gpt-image-1",
        prompt: imageDescription,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      });

      imageData = openaiResponse.data[0]?.b64_json;
      console.log("✅ Successfully generated fallback image with DALL-E");
    } catch (xaiError) {
      console.error("⚠️ Failed to generate image with Grok:", xaiError.message);

      // Fallback: Try OpenAI DALL-E if xAI fails
      console.log("🔄 Falling back to OpenAI DALL-E");
      try {
        // First attempt: Generate the image using xAI's Grok model
        console.log("🤖 Attempting image generation with Grok");
        const xaiResponse = await xAIService.images.generate({
          model: models["grok-2-image-latest"],
          prompt: imageDescription,
          n: 1,
          // size: "1024x1024", only used for open ai models I guess
          response_format: "b64_json",
        });

        imageData = xaiResponse.data[0]?.b64_json;
        console.log("✅ Successfully generated image with Grok");
      } catch (openaiError) {
        console.error("❌ DALL-E fallback also failed:", openaiError.message);
        throw new Error("Failed to generate image with both Grok and DALL-E");
      }
    }

    if (!imageData) {
      throw new Error("No image data received from image generation API");
    }

    // Convert base64 to buffer and save to file
    console.log("💾 Saving generated image to file:", imagePath);
    const buffer = Buffer.from(imageData, "base64");
    await fs.writeFile(imagePath, buffer);

    console.log("✅ Image saved successfully");
    return {
      path: imagePath,
      filename: filename,
      fullPath: path.join("images", filename),
    };
  } catch (error) {
    console.log("💥 Error encountered in image generation");
    console.error("🚨 Error details:", error.message);
    if (error.response) {
      console.error("📋 Detailed error response:", error.response.data);
    }
    throw error;
  }
}

export { sendOpenAIMessage, createImage };
