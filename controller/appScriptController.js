
// Libraries
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const User = require("../models/userModel");
const AccessToken = require("../models/accessTokenModel");
const AppVersion = require("../models/appVersion");
const config = require("../config/jwtConfig");

// Salesforce OAuth Configuration
// const CLIENT_ID = process.env.CLIENT_ID;
// const CLIENT_SECRET =process.env.CLIENT_SECRET;
// const REDIRECT_URI = process.env.REDIRECT_URI;
// const TOKEN_URL = process.env.TOKEN_URL;
// Function to handle user registration

// Salesforce OAuth Configuration
const CLIENT_ID =
  "3MVG9bYGb9rFSjxRGKcqftS.Q4XyGEgKqPBGXj32xT5xpa.NiHWJNJSIUnkuFp5NJKvMIXeUrefkGB1myvxIw";
const CLIENT_SECRET =
  "FB591165951E406DEFE30DAE866241F97144E195CE6157E72EC1D7FAEEBC19C8";
const REDIRECT_URI = "https://katman.io/appscript/callback";
const TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
// Function to handle user registration



/**************************************************************===Login User Start===****************************************************/
 /* @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
/* @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  try {
    const { email, googleScriptId } = req.body;

    if (!email || !googleScriptId) {
      return res.status(400).json({
        success: false,
        error: "Email and googleScriptId are required",
      });
    }

    // Create userId by combining email and googleScriptId
    const userId = `${email}_${googleScriptId}`;

    // Check if user exists
    let user = await User.findOne({ userId });
    let message;
    let accessTokenStatus = null;

    if (!user) {
      // Create a new user
      user = new User({
        email,
        googleScriptId,
        userId,
      });
      await user.save();
      console.log(`New user created: ${userId}`);
      message = "New user created";
    } else {
      // Update last login time
      user.lastLogin = Date.now();
      await user.save();
      console.log(`User logged in: ${userId}`);
      message = "User already exists";

      // Check if there are any access tokens linked to this user
      const accessTokens = await AccessToken.find({ userId: user.userId });

      // Inside the login controller, replace the token refresh section with this:
      if (accessTokens && accessTokens.length > 0) {
        // Access tokens found, refresh them
        const refreshedTokens = [];
        console.log(
          `Found ${accessTokens.length} access tokens for user ${userId}`
        );

        for (const token of accessTokens) {
          try {
            console.log(
              `Attempting to refresh token ${token._id} for scriptId ${token.scriptId}`
            );

            // Force token refresh by manually comparing last refresh time
            const tokenAgeHours =
              (new Date() - new Date(token.lastRefreshed)) / (1000 * 60 * 60);
            console.log(`Token age: ${tokenAgeHours.toFixed(2)} hours`);

            // Call the token refresh function
            const refreshedToken = await refreshSalesforceToken(token);

            if (refreshedToken.wasRefreshed) {
              console.log(
                `Token ${token._id} was successfully refreshed with a new value`
              );
            } else {
              console.log(
                `Token ${token._id} refresh completed but token value did not change`
              );

              // If token is older than 24 hours, flag it as potentially problematic
              if (tokenAgeHours > 24) {
                console.warn(
                  `Warning: Token ${token._id} is ${tokenAgeHours.toFixed(
                    2
                  )} hours old but didn't refresh`
                );
              }
            }

            refreshedTokens.push(refreshedToken);
          } catch (refreshError) {
            console.error(
              `Error refreshing token for ${token._id}:`,
              refreshError
            );
            // Include the original token with an error flag
            token.refreshFailed = true;
            token.refreshError = refreshError.message;
            refreshedTokens.push(token);
          }
        }

        accessTokenStatus = {
          found: true,
          count: accessTokens.length,
          refreshed: refreshedTokens.filter((t) => t.wasRefreshed).length,
          unchanged: refreshedTokens.filter(
            (t) => t.wasRefreshed === false && !t.refreshFailed
          ).length,
          failed: refreshedTokens.filter((t) => t.refreshFailed).length,
          tokenAges: refreshedTokens.map((t) => ({
            id: t._id,
            scriptId: t.scriptId,
            ageHours: (
              (new Date() - new Date(t.lastRefreshed)) /
              (1000 * 60 * 60)
            ).toFixed(2),
          })),
        };

        if (accessTokenStatus.refreshed > 0) {
          message += ", access tokens found and refreshed";
        } else if (accessTokenStatus.unchanged > 0) {
          message += ", access tokens found but no changes needed";
        } else {
          message += ", access tokens found but refresh failed";
        }
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.userId, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiration }
    );

    // Return success with token and message
    return res.status(200).json({
      success: true,
      message,
      token,
      user: {
        email: user.email,
        userId: user.userId,
        createdAt: user.createdAt,
      },
      accessTokenStatus
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      error: "Server error during authentication",
    });
  }
});


/**************************************************************===Login User End===****************************************************/







/**
 * @desc    Execute a custom SOQL query on Salesforce
 * @route   POST /appscript/salesforce/query
 * @access  Private
 */
const executeSalesforceQuery = asyncHandler(async (req, res) => {
  try {
    // Get user ID from JWT payload
    const { userId } = req.user;
    
    // Get the SOQL query from request body
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: "SOQL query is required in the request body"
      });
    }
    
    // Find the user's Salesforce access token
    const accessToken = await AccessToken.findOne({ userId });
    
    if (!accessToken) {
      return res.status(404).json({
        success: false,
        error: "No Salesforce access token found for this user"
      });
    }
    
    // Check if token needs refresh
    const tokenAge = Date.now() - new Date(accessToken.lastRefreshed).getTime();
    const TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
    
    if (tokenAge > TOKEN_EXPIRY) {
      // Token might be expired, attempt to refresh it
      await refreshSalesforceToken(accessToken);
    }
    
    // Encode the SOQL query
    const encodedQuery = encodeURIComponent(query);
    const url = `${accessToken.instanceUrl}/services/data/v56.0/query/?q=${encodedQuery}`;
    
    // Make the request to Salesforce
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        success: false,
        error: errorData[0]?.message || 'Failed to execute query on Salesforce',
        salesforceError: errorData
      });
    }
    
    const data = await response.json();
    
    return res.status(200).json({
      success: true,
      totalRecords: data.totalSize,
      records: data.records,
      done: data.done,
      nextRecordsUrl: data.nextRecordsUrl
    });
    
  } catch (error) {
    console.error("Error executing Salesforce query:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while executing Salesforce query"
    });
  }
});

// Helper function to refresh Salesforce token
// Helper function to refresh Salesforce token 
const refreshSalesforceToken = async (accessTokenDoc) => {
  try {
    // Get refresh token from the document
    const refreshToken = accessTokenDoc.refreshToken;
    
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }
    
    // Store original token for comparison
    const originalAccessToken = accessTokenDoc.accessToken;
    console.log(`Refreshing token for scriptId: ${accessTokenDoc.scriptId}`);
    console.log(`Original access token (first 10 chars): ${originalAccessToken.substring(0, 10)}...`);
    console.log(`Using refresh token (first 10 chars): ${refreshToken.substring(0, 10)}...`);
    
    // Log request details for debugging
    console.log(`Token URL: ${TOKEN_URL}`);
    console.log(`Client ID: ${CLIENT_ID ? 'Configured' : 'Missing'}`);
    console.log(`Client Secret: ${CLIENT_SECRET ? 'Configured' : 'Missing'}`);
    
    const requestParams = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    };
    
    console.log("Request parameters:", JSON.stringify(requestParams, null, 2));
    
    // Exchange the refresh token for a new access token
    const tokenResponse = await axios({
      method: "post",
      url: TOKEN_URL,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams(requestParams).toString(),
    });
    
    // Log full response for debugging (be careful with sensitive data)
    console.log("Token refresh response received:");
    console.log("Response status:", tokenResponse.status);
    console.log("Response headers:", JSON.stringify(tokenResponse.headers, null, 2));
    
    // Log response data with sensitive parts masked
    const sanitizedResponse = { ...tokenResponse.data };
    if (sanitizedResponse.access_token) {
      sanitizedResponse.access_token = `${sanitizedResponse.access_token.substring(0, 10)}...`;
    }
    if (sanitizedResponse.refresh_token) {
      sanitizedResponse.refresh_token = `${sanitizedResponse.refresh_token.substring(0, 10)}...`;
    }
    console.log("Response data:", JSON.stringify(sanitizedResponse, null, 2));
    
    // Verify that we actually received an access token
    const tokenData = tokenResponse.data;
    if (!tokenData.access_token) {
      throw new Error("No access token received in Salesforce response");
    }
    
    // Update the access token document
    accessTokenDoc.accessToken = tokenData.access_token;
    console.log(`New access token (first 10 chars): ${accessTokenDoc.accessToken.substring(0, 10)}...`);
    console.log(`Token changed: ${originalAccessToken !== accessTokenDoc.accessToken}`);
    
    // Salesforce might also return a new refresh token, though not always
    if (tokenData.refresh_token) {
      console.log("New refresh token received");
      accessTokenDoc.refreshToken = tokenData.refresh_token;
    } else {
      console.log("No new refresh token received");
    }
    
    // Update the instance URL if it changed (unlikely but possible)
    if (tokenData.instance_url) {
      console.log(`Instance URL updated from ${accessTokenDoc.instanceUrl} to ${tokenData.instance_url}`);
      accessTokenDoc.instanceUrl = tokenData.instance_url;
    }
    
    // Update the lastRefreshed timestamp
    accessTokenDoc.lastRefreshed = new Date();
    
    // Save the updated document
    await accessTokenDoc.save();
    console.log(`Access token document saved with ID: ${accessTokenDoc._id}`);
    
    // Return a flag indicating whether the token actually changed
    accessTokenDoc.wasRefreshed = originalAccessToken !== accessTokenDoc.accessToken;
    
    return accessTokenDoc;
  } catch (error) {
    console.error("Error refreshing Salesforce token:", error);
    console.error(`Error details: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
    } else if (error.request) {
      console.error("No response received from server");
      console.error(error.request);
    } else {
      console.error("Error during request setup:", error.message);
    }
    throw error;
  }
};

const callbackToken = async (req, res) => {
  try {
    // Get the authorization code and state from the URL
    const code = req.query.code;
    const state = req.query.state;

    if (!code) {
      return res.status(400).send("Authorization code is missing");
    }

    console.log("Received code:", code);
    console.log("Received state:", state);

    // Extract scriptId and email from state
    let scriptId = "";
    let email = "";

    if (state) {
      // Extract scriptId
      const scriptIdMatch = state.match(/scriptId=([^&]+)/i);
      if (scriptIdMatch && scriptIdMatch[1]) {
        scriptId = decodeURIComponent(scriptIdMatch[1]);
      }

      // Extract email
      const emailMatch = state.match(/email=([^&]+)/i);
      if (emailMatch && emailMatch[1]) {
        email = decodeURIComponent(emailMatch[1]);
      }
    }

    // Exchange the code for access tokens
    const tokenResponse = await axios({
      method: "post",
      url: TOKEN_URL,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    const tokenData = tokenResponse.data;

    // Explicitly log access token, refresh token, instance URL, script ID, and email
    console.log("Access Token:", tokenData.access_token);
    console.log("Refresh Token:", tokenData.refresh_token);
    console.log("Instance URL:", tokenData.instance_url);
    console.log("Script ID:", scriptId);
    console.log("User Email:", email);

    // Create userId
    const userId = `${email}_${scriptId}`;

    // Find the user by userId
    const user = await User.findOne({ userId });

    if (!user) {
      // If no user found, send error response
      return res.status(404).send(`
        <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            .error { color: red; font-size: 18px; }
          </style>
        </head>
        <body>
          <h2>Authentication Failed</h2>
          <p class="error">User not found</p>
          <script>
            setTimeout(function() {
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `);
    }

    // Check if an access token already exists for this user and scriptId
    let accessTokenDoc = await AccessToken.findOne({ userId, scriptId });

    if (accessTokenDoc) {
      // Update existing access token
      accessTokenDoc.refreshToken = tokenData.refresh_token;
      accessTokenDoc.instanceUrl = tokenData.instance_url;
      accessTokenDoc.accessToken = tokenData.access_token;
      await accessTokenDoc.save();
    } else {
      // Create new access token
      accessTokenDoc = new AccessToken({
        scriptId,
        refreshToken: tokenData.refresh_token,
        instanceUrl: tokenData.instance_url,
        accessToken: tokenData.access_token,
        email,
        userId,
        user: user._id,
      });
      await accessTokenDoc.save();
    }

    // Send a success response
    res.send(`
  <html>
  <head>
    <title>Authentication Successful</title>
    <style>
      body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
      .success { color: green; font-size: 18px; }
    </style>
  </head>
  <body>
    <h2>Authentication Successful</h2>
    <p class="success">✓ Authentication and token storage complete</p>
    <p>You can now close this window</p>
    <script>
      // Close the window automatically after 3 seconds
      setTimeout(function() {
        window.close();
      }, 3000);
    </script>
  </body>
  </html>
`);
  } catch (error) {
    console.error("Error in callback:", error);
    const errorMsg = (error.response && error.response.data) || error.message;
    return res.status(500).send(`
      <html>
      <head>
        <title>Authentication Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
          .error { color: red; font-size: 18px; }
        </style>
      </head>
      <body>
        <h2>Authentication Failed</h2>
        <p class="error">Error: ${errorMsg}</p>
        <script>
          setTimeout(function() {
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `);
  }
};

/**
 * @desc    Delete or revoke a user's access token
 * @route   GET /appscript/deleteToken
 * @access  Private
 */
const deleteAccessToken = asyncHandler(async (req, res) => {
  try {
    // Use the authenticated user ID from the JWT token
    const { userId } = req.user;
    
    // Extract the googleScriptId from query parameters for GET request
    const { googleScriptId } = req.query;

    // Validate input
    if (!googleScriptId) {
      return res.status(400).json({
        success: false,
        message: "googleScriptId is required as a query parameter",
      });
    }

    // Extract email from userId (assuming userId format is 'email_googleScriptId')
    const email = userId.split('_')[0];

    // Find the user first to confirm they exist
    const user = await User.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Find and delete the access token
    const deletedAccessToken = await AccessToken.findOneAndDelete({
      userId,
      scriptId: googleScriptId,
    });

    // If no access token found
    if (!deletedAccessToken) {
      return res.status(404).json({
        success: false,
        message: "No access token found with the given credentials",
      });
    }

    res.status(200).json({
      success: true,
      message: "Access token deleted successfully",
      data: {
        userId,
        googleScriptId: deletedAccessToken.scriptId,
        email: deletedAccessToken.email,
      },
    });
  } catch (err) {
    console.error("Error deleting access token:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error while deleting access token" 
    });
  }
});


/**
 * @desc    Get Salesforce user information
 * @route   GET /appscript/salesforce/userinfo
 * @access  Private
 */
const getSalesforceUserInfo = asyncHandler(async (req, res) => {
  try {
    // Get user ID from JWT payload
    const { userId } = req.user;
    
    // Find the user's Salesforce access token
    const accessToken = await AccessToken.findOne({ userId });
    
    if (!accessToken) {
      return res.status(404).json({
        success: false,
        error: "No Salesforce access token found for this user"
      });
    }
    
    // Check if token needs refresh
    const tokenAge = Date.now() - new Date(accessToken.lastRefreshed).getTime();
    const TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
    
    if (tokenAge > TOKEN_EXPIRY) {
      // Token might be expired, attempt to refresh it
      await refreshSalesforceToken(accessToken);
    }
    
    // Set up the URL for Salesforce OAuth userinfo endpoint
    const url = `${accessToken.instanceUrl}/services/oauth2/userinfo`;
    
    // Make the request to Salesforce userinfo endpoint
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { rawError: errorText };
      }
      
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch user information from Salesforce',
        salesforceError: errorData
      });
    }
    
    const userData = await response.json();
    
    return res.status(200).json({
      success: true,
      userInfo: userData
    });
    
  } catch (error) {
    console.error("Error fetching Salesforce user info:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while fetching Salesforce user information"
    });
  }
});



module.exports = {
  deleteAccessToken,
  callbackToken,
  login,
  executeSalesforceQuery,
  getSalesforceUserInfo,
};
