import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const llm = "openai";

class OpenAIService {
  constructor() {
    // Initialize the OpenAI SDK with custom baseURL to route to our executor
    this.openai = new OpenAI({
      apiKey:
        llm === "openai" ? process.env.OPENAI_API_KEY : process.env.XAI_API_KEY,
      baseURL:
        llm === "openai" ? "https://api.openai.com/v1" : "https://api.x.ai/v1",
    });
  }

  async sendMessage(messages, systemPrompt) {
    try {
      // Prepare the system message if provided
      const messageArray = messages.map((msg) => {
        if (msg.role === "system") {
          return;
        } else {
          return {
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
            max_tokens: 1024,
            temperature: 0.7,
          };
        }
      });
      if (messageArray.length > 3) {
        messageArray.splice(0, messageArray.length - 3);
      }

      messageArray.unshift({ role: "system", content: systemPrompt });

      console.log("👀👀👀👀 messageArray:: ", messageArray);

      // Use OpenAI SDK to create chat completion
      const response = await this.openai.chat.completions.create({
        model: llm === "openai" ? "gpt-4o" : "grok-2-1212",
        messages: messageArray,
        temperature: 0.6,
        max_tokens: 1024,
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error("Error communicating with xAI API:", error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
      }
      throw error;
    }
  }
}

export default new OpenAIService();
