const asyncHandler = require("express-async-handler");

const authenticate = asyncHandler(async (req, res) => {
  // Logic for authenticating AppScript (e.g., async API call)
  res.send("AppScript Authentication Route");
});

const sendData = asyncHandler(async (req, res) => {
  // Logic for sending data to AppScript (e.g., async API call)
  const requestData = req.body;
  res.send("Data sent to AppScript");
});

const environmentData = asyncHandler(async (req, res) => {
  const envData = {
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    REDIRECT_URI: process.env.REDIRECT_URI,
    AUTH_URL: process.env.AUTH_URL,
    TOKEN_URL: process.env.TOKEN_URL,
  };
  res.json(envData); // Responding with the environment data
});

module.exports = { authenticate, sendData, environmentData };
