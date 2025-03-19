// userModel.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Define the User schema
const userSchema = new Schema({
  googleSheetId: {
    type: String,
    required: true,
    unique: true, // Ensures that the username is unique in the database
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true, // Ensures that the email is unique in the database
    lowercase: true, // Automatically convert email to lowercase
    trim: true,
    match: [/.+\@.+\..+/, "Please fill a valid email address"], // Simple email validation
  },

  createdAt: {
    type: Date,
    default: Date.now, // Automatically set to the current date/time
  },
});

// Create a model based on the schema
const User = mongoose.model("User", userSchema);

// Export the model so it can be used elsewhere in the application
module.exports = User;
