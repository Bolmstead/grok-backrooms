import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import Message from "../models/Message.js";
import { servicePrompts } from "../constants.js";

dotenv.config();

class AnthropicService {
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("Warning: No Anthropic API key found!");
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async sendMessage(sender, messages, temperature = 0.6, maxTokens = 1024) {
    try {
      // Filter out any system messages and only keep user/assistant messages
      const messageArray = messages
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        }));
      if (messageArray.length > 3) {
        messageArray.splice(0, messageArray.length - 3);
      }

      console.log("👀👀👀👀 Messages array for Anthropic:", messageArray);
      const systemPromptText =
        sender === "grok1"
          ? servicePrompts.backroomsGrok1
          : servicePrompts.backroomsGrok2;

      const model = "claude-3-opus-20240229";

      // Create the API request with the system, as a top-level parameter
      const response = await this.anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPromptText, // System prompt goes here as a top-level parameter
        messages: messageArray, // Only user/assistant messages here
      });

      if (
        !response ||
        !response.content ||
        !response.content[0] ||
        !response.content[0].text
      ) {
        console.error(
          "Invalid response format from Anthropic:",
          JSON.stringify(response, null, 2)
        );
        throw new Error("Invalid response from Anthropic API");
      }

      const content = response.content[0].text;

      // Save Grok2's message to the database
      const dbMessage = new Message({
        sender,
        model,
        maxTokens,
        temperature,
        backroomId: "Chapter 1",
        content: content,
        systemMessage: systemPromptText,
      });
      await dbMessage.save();
      console.log(`Received response from Anthropic (${content.length} chars)`);
      return dbMessage;
    } catch (error) {
      console.error("Error communicating with Anthropic API:", error.message);

      // Provide meaningful error messages
      if (error.status === 401) {
        throw new Error("Authentication failed. Check your Anthropic API key.");
      } else if (error.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      } else if (error.status >= 500) {
        throw new Error("Anthropic service error. Please try again later.");
      }

      throw error;
    }
  }
}

export default new AnthropicService();
