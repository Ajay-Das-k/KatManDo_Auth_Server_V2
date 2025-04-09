const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    googleScriptId: {
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
      unique: true,
      required: true,
      index: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    // Add a pre-save middleware to generate userId
    pre: {
      save: function (next) {
        // Generate userId by combining email and googleScriptId
        if (!this.userId) {
          this.userId = `${this.email}_${this.googleScriptId}`;
        }
        next();
      },
    },
  }
);

// Add a unique compound index for email and googleScriptId
userSchema.index({ email: 1, googleScriptId: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
