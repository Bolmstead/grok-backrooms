import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  messageCreatedBy: {
    type: String,
    enum: ["ai1", "ai2", "user", "status"],
    required: true,
  },
  scenario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scenario",
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Create text index on content field
MessageSchema.index({ content: "text" });

export default mongoose.model("Message", MessageSchema);
