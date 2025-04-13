import OpenAI from "openai";
import dotenv from "dotenv";
import Message from "../models/Message.js";
import { backroomIds, servicePrompts } from "../constants.js";
dotenv.config();

const llm = "xai";

class OpenAIService {
  constructor() {
    // Initialize the OpenAI SDK with custom baseURL to route to our executor
    const params = {
      apiKey:
        llm === "openai" ? process.env.OPENAI_API_KEY : process.env.XAI_API_KEY,
      baseURL:
        llm === "openai" ? "https://api.openai.com/v1" : "https://api.x.ai/v1",
    };
    console.log("🚀 ~ OpenAIService ~ constructor ~ params:", params);
    this.openai = new OpenAI(params);
  }

  async sendMessage(sender, messages, temperature = 0.6, maxTokens = 1024) {
    try {
      let systemPrompt;
      if (sender === "grok1") {
        systemPrompt = servicePrompts.backroomsGrok1;
      } else if (sender === "grok2") {
        systemPrompt = servicePrompts.backroomsGrok2;
      }
      const backroomId = backroomIds.chapter1;
      // Prepare the system message if provided
      const messageArray = messages.map((msg) => {
        if (msg.role === "system") {
          return;
        } else {
          return {
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
          };
        }
      });
      if (messageArray.length > 3) {
        messageArray.splice(0, messageArray.length - 3);
      }

      const systemMessage = { role: "system", content: systemPrompt };

      messageArray.unshift(systemMessage);

      const systemMessageToString = JSON.stringify(systemMessage, null, 2);

      console.log("👀👀👀👀 messageArray:: ", messageArray);

      const model = llm === "openai" ? "gpt-4o" : "grok-2-1212";

      // Use OpenAI SDK to create chat completion
      const response = await this.openai.chat.completions.create({
        model,
        messages: messageArray,
        temperature,
        max_tokens: maxTokens,
      });

      const responseMessage = response.choices[0].message.content;

      // Save Grok2's message to the database
      const dbMessage = new Message({
        sender,
        model,
        maxTokens,
        temperature,
        backroomId,
        content: responseMessage,
        systemMessage: systemMessageToString,
      });
      await dbMessage.save();

      return responseMessage;
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
