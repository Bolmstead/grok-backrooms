import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

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

  async sendMessage(messages, systemPrompt) {
    try {
      // Filter out any system messages and only keep user/assistant messages
      const messageArray = messages
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        }));

      console.log("👀👀👀👀 Messages array for Anthropic:", messageArray);

      // Create the API request with the system as a top-level parameter
      const response = await this.anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 1024,
        temperature: 0.7,
        system: systemPrompt, // System prompt goes here as a top-level parameter
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
      console.log(`Received response from Anthropic (${content.length} chars)`);
      return content;
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
