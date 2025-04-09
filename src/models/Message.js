import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  sender: {
    type: String,
    enum: ["grok1", "grok2"],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  conversationId: {
    type: String,
    required: true,
  },
});

export default mongoose.model("Message", MessageSchema);
