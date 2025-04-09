
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



// Add this method to your appScriptController.js file

/**
 * @desc    Get user details and access tokens
 * @route   GET /api/auth/user
 * @access  Private
 */
const getUserDetails = asyncHandler(async (req, res) => {
  try {
    // Get user ID from JWT payload
    const { userId } = req.user;

    // Find user in database
    const user = await User.findOne({ userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Find all access tokens for this user
    const accessTokens = await AccessToken.find({ userId: user.userId });

    // Format access tokens for response (don't expose sensitive data)
    const formattedTokens = accessTokens.map(token => ({
      id: token._id,
      scriptId: token.scriptId,
      instanceUrl: token.instanceUrl,
      lastRefreshed: token.lastRefreshed,
      createdAt: token.createdAt
    }));

    // Return user details and access tokens
    return res.status(200).json({
      success: true,
      user: {
        email: user.email,
        userId: user.userId,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      accessTokens: formattedTokens,
      tokenCount: formattedTokens.length
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while fetching user details",
    });
  }
});



/**
 * @desc    Fetch data for a specific Salesforce object
 * @route   GET /api/salesforce/object/:objectName
 * @access  Private
 */
const getSalesforceObject = asyncHandler(async (req, res) => {
  try {
    // Get user ID from JWT payload
    const { userId } = req.user;
    
    // Get the Salesforce object name from URL parameters
    const { objectName } = req.params;
    
    // Optional query parameters for filtering
    const { limit = 10, fields, where } = req.query;
    
    // Find the user's Salesforce access token
    const accessToken = await AccessToken.findOne({ userId });
    
    if (!accessToken) {
      return res.status(404).json({
        success: false,
        error: "No Salesforce access token found for this user",
      });
    }
    
    // Check if token needs refresh (you might want to implement a refresh mechanism)
    const tokenAge = Date.now() - new Date(accessToken.lastRefreshed).getTime();
    const TOKEN_EXPIRY = 60 * 60 * 1000; // Example: 1 hour in milliseconds
    
    if (tokenAge > TOKEN_EXPIRY) {
      // Token might be expired, attempt to refresh it
      // This is a placeholder for your token refresh logic
      await refreshSalesforceToken(accessToken);
    }
    
    // Construct the Salesforce API URL
    let url = `${accessToken.instanceUrl}/services/data/v56.0/sobjects/${objectName}/describe`;
    
    // If fields are specified, prepare them for the query
    let queryFields = '';
    if (fields) {
      queryFields = fields.split(',').join(',');
    }
    
    // If specific query is needed instead of describe
    if (queryFields || where) {
      // Construct a SOQL query
      let query = `SELECT ${queryFields || 'Id, Name'} FROM ${objectName}`;
      if (where) {
        query += ` WHERE ${where}`;
      }
      query += ` LIMIT ${limit}`;
      
      // Encode the SOQL query
      const encodedQuery = encodeURIComponent(query);
      url = `${accessToken.instanceUrl}/services/data/v56.0/query/?q=${encodedQuery}`;
    }
    
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
        error: errorData[0]?.message || 'Failed to fetch data from Salesforce',
        salesforceError: errorData
      });
    }
    
    const data = await response.json();
    
    return res.status(200).json({
      success: true,
      salesforceObject: objectName,
      data
    });
    
  } catch (error) {
    console.error("Error fetching Salesforce object data:", error);
    return res.status(500).json({
      success: false,
      error: "Server error while fetching Salesforce data",
    });
  }
});
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

const userRegister = async (req, res) => {
  console.log("Request Body:", req.body);

  const { googleScriptId, email } = req.body;

  if (!googleScriptId || !email) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  try {
    // Create userId by combining email and googleScriptId
    const userId = `${email}_${googleScriptId}`;

    // Check if user exists with the exact combination of email and googleScriptId
    const existingUser = await User.findOne({ email, googleScriptId });

    if (existingUser) {
      // Look for associated access tokens
      const tokens = await AccessToken.find({ user: existingUser._id });

      if (tokens.length > 0) {
        // Refresh each token before sending the response
        const refreshedTokens = [];

        for (const token of tokens) {
          try {
            // Call the token refresh function
            const refreshedToken = await refreshSalesforceToken(token);
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

        return res.status(200).json({
          message: "User already exists. Access tokens found and refreshed.",
          user: {
            userId: existingUser.userId,
            googleScriptId: existingUser.googleScriptId,
            email: existingUser.email,
          },
          accessTokens: refreshedTokens,
        });
      } else {
        return res.status(200).json({
          message: "User already exists. No access tokens found.",
          user: {
            userId: existingUser.userId,
            googleScriptId: existingUser.googleScriptId,
            email: existingUser.email,
          },
        });
      }
    }

    // User does not exist, create new one
    const newUser = new User({
      googleScriptId,
      email,
      userId: userId, // Explicitly set userId
    });

    const savedUser = await newUser.save();

    res.status(201).json({
      message: "User registered successfully!",
      user: {
        userId: savedUser.userId,
        googleScriptId: savedUser.googleScriptId,
        email: savedUser.email,
      },
    });
  } catch (err) {
    console.error(err);

    // Handle unique constraint violation
    if (err.code === 11000) {
      return res.status(409).json({
        message:
          "User with this email and Google Script ID combination already exists",
      });
    }

    res.status(500).json({ message: "Server error" });
  }
};

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
const createAccessToken = async (req, res) => {
  try {
    const { scriptId, refreshToken, instanceUrl, accessToken, email } =
      req.body;

    // Validate required fields
    if (!scriptId || !refreshToken || !instanceUrl || !accessToken || !email) {
      return res.status(400).json({
        message:
          "All fields are required: scriptId, refreshToken, instanceUrl, accessToken, email",
      });
    }

    // Create userId
    const userId = `${email}_${scriptId}`;

    // Find the user by userId
    const user = await User.findOne({ userId });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if an access token already exists for this user and scriptId
    const existingAccessToken = await AccessToken.findOne({
      userId,
      scriptId,
    });

    if (existingAccessToken) {
      // Update existing access token
      existingAccessToken.refreshToken = refreshToken;
      existingAccessToken.instanceUrl = instanceUrl;
      existingAccessToken.accessToken = accessToken;

      const updatedAccessToken = await existingAccessToken.save();

      return res.status(200).json({
        message: "Access token updated successfully",
        accessToken: updatedAccessToken,
      });
    }

    // Create new access token
    const newAccessToken = new AccessToken({
      scriptId,
      refreshToken,
      instanceUrl,
      accessToken,
      email,
      userId,
      user: user._id,
    });

    const savedAccessToken = await newAccessToken.save();

    res.status(201).json({
      message: "Access token created successfully",
      accessToken: savedAccessToken,
    });
  } catch (err) {
    console.error(err);

    // Handle unique constraint violation
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Access token for this user and script already exists",
      });
    }

    res.status(500).json({ message: "Server error" });
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

const deleteAccessToken = async (req, res) => {
  try {
    const { email, googleScriptId } = req.body;

    // Validate input
    if (!email || !googleScriptId) {
      return res.status(400).json({
        message: "Both email and googleScriptId are required",
      });
    }

    // Create userId
    const userId = `${email}_${googleScriptId}`;

    // Find and delete the access token
    const deletedAccessToken = await AccessToken.findOneAndDelete({
      email,
      scriptId: googleScriptId,
    });

    // If no access token found
    if (!deletedAccessToken) {
      return res.status(404).json({
        message:
          "No access token found with the given email and googleScriptId",
      });
    }

    // Remove the reference from the user's accessTokens array
    await User.findOneAndUpdate(
      { userId },
      { $pull: { accessTokens: deletedAccessToken._id } }
    );

    res.status(200).json({
      message: "Access token deleted successfully",
      deletedAccessToken: {
        userId,
        googleScriptId: deletedAccessToken.scriptId,
        email: deletedAccessToken.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getAccessTokens = async (req, res) => {
  try {
    const { email, googleScriptId } = req.query;

    // Validate input
    if (!email || !googleScriptId) {
      return res.status(400).json({
        message: "Email and Google Script ID are required",
      });
    }

    // Create userId
    const userId = `${email}_${googleScriptId}`;

    // Find access tokens for the user
    const accessTokens = await AccessToken.find({
      userId: userId,
    }).select("-__v"); // Exclude version key

    // If no access tokens found
    if (!accessTokens || accessTokens.length === 0) {
      return res.status(404).json({
        message: "No access tokens found for this user",
      });
    }

    // Return access tokens
    res.status(200).json({
      message: "Access tokens retrieved successfully",
      accessTokens: accessTokens,
    });
  } catch (error) {
    console.error("Error retrieving access tokens:", error);
    res.status(500).json({
      message: "Server error while retrieving access tokens",
    });
  }
};


const createVersion = async (req, res) => {
  try {
    // Check if version already exists
    const existingVersion = await AppVersion.findOne({
      versionNumber: req.body.versionNumber,
    });

    if (existingVersion) {
      return res.status(409).json({
        success: false,
        message: "Version with this number already exists",
      });
    }

    // Create new version document
    const newVersion = new AppVersion(req.body);

    // Save the version to database
    const savedVersion = await newVersion.save();

    res.status(201).json({
      success: true,
      message: "Version created successfully",
      data: savedVersion,
    });
  } catch (error) {
    console.error("Error creating version:", error);
    res.status(500).json({
      success: false,
      message: "Error creating version",
      error: error.message,
    });
  }
};

const getAllVersions = async (req, res) => {
  try {
    const versions = await AppVersion.find().sort({ releaseDate: -1 });
    res.status(200).json({
      success: true,
      count: versions.length,
      data: versions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching versions",
      error: error.message,
    });
  }
};


const checkVersion = async (req, res) => {
  try {
    // Get the version number from request body
    const { versionNumber } = req.body;

    if (!versionNumber) {
      return res.status(400).json({
        success: false,
        message: "Version number is required",
      });
    }

    // Find the latest version in the database
    // Use versionNumber for sorting instead of releaseDate to get the semantically highest version
    const allVersions = await AppVersion.find({ isStable: true });

    if (allVersions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No versions found in database",
      });
    }

    // Sort versions semantically to find the latest one
    allVersions.sort((a, b) => {
      return compareVersions(b.versionNumber, a.versionNumber);
    });

    const latestVersion = allVersions[0];

    // Debug logging - remove in production
    console.log(
      `Comparing user version: ${versionNumber} with latest version: ${latestVersion.versionNumber}`
    );

    // Compare versions
    const comparison = compareVersions(
      versionNumber,
      latestVersion.versionNumber
    );
    console.log(`Comparison result: ${comparison}`);

    const isUpToDate = comparison >= 0;

    if (isUpToDate) {
      return res.status(200).json({
        success: true,
        message: "Version is up to date",
        isUpToDate: true,
        currentVersion: versionNumber,
        latestVersion: latestVersion.versionNumber,
        environment: latestVersion.environment,
      });
    } else {
      return res.status(200).json({
        success: true,
        message: "Version is not up to date",
        isUpToDate: false,
        currentVersion: versionNumber,
        latestVersion: latestVersion.versionNumber,
        updateRequired: true,
        latestVersionInfo: {
          versionNumber: latestVersion.versionNumber,
          releaseDate: latestVersion.releaseDate,
          description: latestVersion.description,
          environment: latestVersion.environment,
        },
      });
    }
  } catch (error) {
    console.error("Error checking version:", error);
    res.status(500).json({
      success: false,
      message: "Error checking version",
      error: error.message,
    });
  }
};

// Improved version comparison function
function compareVersions(version1, version2) {
  // Split versions into parts and convert to numbers
  const parts1 = version1.split(".").map((part) => parseInt(part, 10));
  const parts2 = version2.split(".").map((part) => parseInt(part, 10));

  // Compare each part
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    // If parts1 has fewer components than parts2, treat missing parts as 0
    const v1 = i < parts1.length ? parts1[i] : 0;
    // If parts2 has fewer components than parts1, treat missing parts as 0
    const v2 = i < parts2.length ? parts2[i] : 0;

    if (v1 > v2) return 1;
    if (v1 < v2) return -1;
  }

  // If we get here, the versions are equal
  return 0;
}

module.exports = {
  userRegister,
  createAccessToken,
  deleteAccessToken,
  callbackToken,
  getAccessTokens,
  createVersion,
  getAllVersions,
  checkVersion,
  login,
  getUserDetails,
  getSalesforceObject,
  executeSalesforceQuery
};
