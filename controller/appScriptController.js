const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const AccessToken = require("../models/accessTokenModel");
const axios = require("axios");

// Salesforce OAuth Configuration
const CLIENT_ID =
  "3MVG9bYGb9rFSjxRGKcqftS.Q4XyGEgKqPBGXj32xT5xpa.NiHWJNJSIUnkuFp5NJKvMIXeUrefkGB1myvxIw";
const CLIENT_SECRET =
  "FB591165951E406DEFE30DAE866241F97144E195CE6157E72EC1D7FAEEBC19C8";
const TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
const REDIRECT_URI = "https://katman.io/appscript/callback";

// Function to handle user registration
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
        return res.status(200).json({
          message: "User already exists. Access tokens found.",
          user: {
            userId: existingUser.userId,
            googleScriptId: existingUser.googleScriptId,
            email: existingUser.email,
          },
          accessTokens: tokens,
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
      return res.status(400).send('Authorization code is missing');
    }
    
    console.log('Received code:', code);
    console.log('Received state:', state);

    // Try to extract the scriptId from the state
    let scriptId = DEFAULT_SCRIPT_ID;
    let extractionMethod = 'default';
    
    // Method 1: Look for a scriptId parameter in the state
    if (state && state.includes('scriptId')) {
      const scriptIdMatch = state.match(/scriptId=([^&]+)/i);
      if (scriptIdMatch && scriptIdMatch[1]) {
        scriptId = scriptIdMatch[1];
        extractionMethod = 'regex';
      }
    }
    
    // Log the script ID and how we got it
    console.log(`Using script ID: ${scriptId} (extraction method: ${extractionMethod})`);

    // Exchange the code for access tokens
    const tokenResponse = await axios({
      method: 'post',
      url: TOKEN_URL,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      }).toString()
    });
    
    const tokenData = tokenResponse.data;
    console.log('Received token data:', JSON.stringify(tokenData, null, 2));

    // Try multiple URL formats for Google Apps Script
    // Option 1: Using the deployed web app URL format
    const scriptCallbackUrl = `https://script.google.com/macros/s/${scriptId}/exec`;
    
    // Build the redirect URL with token data
    const params = new URLSearchParams({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      instance_url: tokenData.instance_url,
      id: tokenData.id,
      issued_at: tokenData.issued_at,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      callback: 'true' // Add a parameter to indicate this is a callback
    });
    
    // Add code and state parameters to preserve the original OAuth flow
    if (code) params.append('code', code);
    if (state) params.append('state', state);
    
    const redirectUrl = `${scriptCallbackUrl}?${params.toString()}`;
    
    console.log('Redirecting to:', redirectUrl);
    
    // Redirect directly to the Apps Script
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in callback:', error);
   const errorMsg = (error.response && error.response.data) || error.message;

    return res.status(500).send(`Error processing authentication: ${errorMsg}`);
  }
  }

  // Log the script ID and how we got it
  console.log(
    `Using script ID: ${scriptId} (extraction method: ${extractionMethod})`
  );

  // Comprehensive logging of all received query parameters
  console.log("Full query parameters:", JSON.stringify(req.query, null, 2));

  // Prepare response
  const responseData = {
    code: code,
    state: state,
    scriptId: scriptId,
    extractionMethod: extractionMethod,
  };

  // Send a response (or you can redirect as in your original code)
  return res.status(200).json(responseData);
} catch (error) {
  console.error("Error in callback:", error);
  const errorMsg = (error.response && error.response.data) || error.message;

  return res.status(500).send(`Error processing authentication: ${errorMsg}`);
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




(module.exports = {
  userRegister,
  createAccessToken,
  deleteAccessToken,
  callbackToken,
});
