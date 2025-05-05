import mongoose from "mongoose";
import { models } from "../constants.js";

const ScenarioSchema = new mongoose.Schema({
  scenarioId: {
    type: String,
    required: true,
  },
  ai1Name: {
    type: String,
    required: true,
  },
  ai2Name: {
    type: String,
    required: true,
  },
  startingContextAI1: [
    {
      role: {
        type: String,
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
    },
  ],
  startingContextAI2: [
    {
      role: {
        type: String,
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
    },
  ],
  ai1Model: {
    type: String,
    required: true,
  },
  ai2Model: {
    type: String,
    required: true,
  },
  systemMessageAI1: {
    type: String,
    required: true,
  },
  systemMessageAI2: {
    type: String,
    required: true,
  },
  maxTokens: {
    type: Number,
    required: true,
  },
  ai1Temperature: {
    type: Number,
    required: true,
  },
  ai2Temperature: {
    type: Number,
    required: true,
  },
  createMemeCoins: {
    type: Boolean,
    required: false,
  },
  coinCreationRequest: {
    type: String,
    required: false,
  },
  localLLM: {
    type: Boolean,
    required: false,
  },
});

export default mongoose.model("Scenario", ScenarioSchema);
