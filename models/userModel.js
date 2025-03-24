const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Define the User schema
const userSchema = new Schema({
  googleSheetId: {
    type: String,
    required: true, // Ensures googleSheetId is provided
    unique: true, // Ensures googleSheetId is unique in the database
    trim: true, // Trims any leading/trailing spaces
  },
  email: {
    type: String,
    required: true, // Ensures email is provided
    unique: true, // Ensures email is unique in the database
    lowercase: true, // Automatically convert email to lowercase
    trim: true, // Trims any leading/trailing spaces
    match: [/.+\@.+\..+/, "Please fill a valid email address"], // Simple email validation
  },

  createdAt: {
    type: Date,
    default: Date.now, // Automatically set the current date/time when user is created
  },
});

// Create a model based on the schema
const User = mongoose.model("User", userSchema);

// Export the model so it can be used elsewhere in the application
module.exports = User;
