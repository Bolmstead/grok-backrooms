import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    scenario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scenario",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    messageCreatedBy: {
      type: String,
      enum: ["ai1", "ai2", "user", "status"],
      required: true,
    },
    coinCreationRequest: {
      type: Object,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Create text index on content field
messageSchema.index({ content: "text" });

const Message = mongoose.model("Message", messageSchema);

export default Message;
