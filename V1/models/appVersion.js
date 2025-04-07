// MongoDB Schema for AppVersion Collection

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Define the schema for changes made in each version
const ChangeSchema = new Schema({
  type: {
    type: String,
    enum: ["feature", "bugfix", "improvement", "security", "other"],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  component: {
    type: String,
    required: false,
  },
  issueReference: {
    type: String,
    required: false,
  },
});

// Define the main AppVersion schema
const AppVersionSchema = new Schema({
  versionNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  buildNumber: {
    type: Number,
    required: false,
  },
  releaseDate: {
    type: Date,
    default: Date.now,
  },
  description: {
    type: String,
    required: true,
  },
  changes: [ChangeSchema],
  author: {
    type: String,
    required: false,
  },
  isStable: {
    type: Boolean,
    default: true,
  },
  environment: {
    type: String,
    enum: ["development", "staging", "production"],
    default: "development",
  },
  dependencies: {
    type: Map,
    of: String,
    default: {},
  },
  notes: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Middleware to update the 'updatedAt' field on updates
AppVersionSchema.pre("save", function (next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
  }
  next();
});

// Create the model from the schema
const AppVersion = mongoose.model("AppVersion", AppVersionSchema);

module.exports = AppVersion;
