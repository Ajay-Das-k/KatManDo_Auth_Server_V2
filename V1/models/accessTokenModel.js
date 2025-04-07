const mongoose = require("mongoose");

const accessTokenSchema = new mongoose.Schema(
  {
    scriptId: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    instanceUrl: {
      type: String,
      required: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    userId: {
      type: String,
      required: true,
      ref: "User", // Reference to the User model
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastRefreshed: {
      type: Date,
      default: Date.now, // Default to the current time when created
    },
  },
  {
    timestamps: true,
  }
);

// Add a compound index for user identification
accessTokenSchema.index({ userId: 1, scriptId: 1 }, { unique: true });

module.exports = mongoose.model("AccessToken", accessTokenSchema);
