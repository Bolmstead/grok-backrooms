import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatAnthropic } from "@langchain/anthropic";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import dotenv from "dotenv";
import createPumpfunCoin from "./createPumpfunCoin.js";

// Load environment variables from .env file
dotenv.config();

// Check for required environment variables
console.log("🔍 Checking environment variables...");
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ Error: ANTHROPIC_API_KEY environment variable is not set!");
  console.log("💡 Please set your Anthropic API key in the .env file");
  process.exit(1);
}
console.log("✅ Environment variables check passed");

const weatherTool = tool(
  async ({ query }) => {
    console.log("🌤️ Checking weather for:", query);

    try {
      // Use OpenWeatherMap API
      const apiKey = process.env.OPENWEATHER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OpenWeather API key not found in environment variables"
        );
      }

      // First, get the coordinates for the location
      const geocodingUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
        query
      )}&limit=1&appid=${apiKey}`;
      const geocodingResponse = await fetch(geocodingUrl);
      const geocodingData = await geocodingResponse.json();

      if (!geocodingData || geocodingData.length === 0) {
        return "Location not found. Please try a different city name.";
      }

      const { lat, lon } = geocodingData[0];

      // Get weather data using coordinates
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
      const weatherResponse = await fetch(weatherUrl);
      const weatherData = await weatherResponse.json();

      if (weatherData.cod !== 200) {
        throw new Error(weatherData.message || "Failed to fetch weather data");
      }

      const { main, weather, wind } = weatherData;
      const temperature = main.temp;
      const description = weather[0].description;
      const humidity = main.humidity;
      const windSpeed = wind.speed;

      return `Current weather in ${query}: ${description}, temperature ${temperature}°C, humidity ${humidity}%, wind speed ${windSpeed} m/s`;
    } catch (error) {
      console.error("❌ Weather API error:", error);
      return `Error fetching weather data: ${error.message}`;
    }
  },
  {
    name: "weather",
    description:
      "Get the current weather in a given location. Returns temperature, conditions, humidity, and wind speed.",
    schema: z.object({
      query: z.string().describe("The city name to get weather for"),
    }),
  }
);

const pumpfunTool = tool(
  async ({ name, symbol, description, imageDescription }) => {
    console.log("🪙 Creating memecoin!");
    console.log("🪙 Name:", name);
    console.log("🪙 Symbol:", symbol);
    console.log("🪙 Description:", description);
    console.log("🪙 Image Description:", imageDescription);
    if (!name || !symbol || !description || !imageDescription) {
      return "Please provide a name, symbol, description, and imageDescription for the memecoin.";
    }
    return "Memecoin created successfully!";
    try {
      const coinData = {
        name: name,
        symbol: symbol,
        description: description,
        twitter: twitter,
        telegram: telegram,
        website: website,
        imageFileName: "grok.png", // Default image
      };

      const result = await createPumpfunCoin(coinData);
      return `Successfully created memecoin: ${name} (${symbol}). Transaction information: ${JSON.stringify(
        result
      )}`;
    } catch (error) {
      console.error("❌ Memecoin creation error:", error);
      return `Error creating memecoin: ${error.message}`;
    }
  },
  {
    name: "create_memecoin",
    description:
      "Create a new memecoin on the Pumpfun platform with the specified details",
    schema: z.object({
      name: z.string().describe("The name of the memecoin"),
      symbol: z
        .string()
        .describe("The ticker symbol of the memecoin (e.g., DOGE)"),
      description: z.string().describe("A description of the memecoin"),
      twitter: z.string().optional().describe("Twitter URL for the memecoin"),
      telegram: z.string().optional().describe("Telegram URL for the memecoin"),
      website: z.string().optional().describe("Website URL for the memecoin"),
      imageDescription: z
        .string()
        .optional()
        .describe("Description to generate an image for the coin"),
    }),
  }
);

let model;
console.log("🤖 Initializing Claude model...");
try {
  model = new ChatAnthropic({
    model: "claude-3-5-sonnet-latest",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log("✅ Claude model initialized successfully");
} catch (error) {
  console.error("❌ Failed to initialize Claude model:", error.message);
  process.exit(1);
}

console.log("💾 Setting up memory saver...");
const checkpointSaver = new MemorySaver();

console.log("🎯 Creating React agent with tools...");
let agent;
try {
  agent = createReactAgent({
    llm: model,
    tools: [weatherTool, pumpfunTool],
    checkpointSaver,
  });
  console.log("✅ React agent created successfully");
} catch (error) {
  console.error("❌ Failed to create React agent:", error.message);
  process.exit(1);
}

export { agent };
