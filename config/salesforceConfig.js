// config/salesforceConfig.js
const salesforceConfig = () => {
  try {
    const config = {
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      redirectUri: process.env.REDIRECT_URI,
      tokenUrl: process.env.TOKEN_URL,
      authUrl: process.env.AUTH_URL,
    };

    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
      throw new Error("Missing Salesforce config values in environment.");
    }

    console.log("Salesforce Config Loaded Successfully");
    return config;
  } catch (error) {
    console.error("Error loading Salesforce Config:", error.message);
    process.exit(1);
  }
};

module.exports = { salesforceConfig };
