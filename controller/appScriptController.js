//Ajay is great V1

const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const AccessToken = require("../models/accessTokenModel");
const AppVersion = require("../models/AppVersion");
const axios = require("axios");

// Salesforce OAuth Configuration
const CLIENT_ID =
  "3MVG9bYGb9rFSjxRGKcqftS.Q4XyGEgKqPBGXj32xT5xpa.NiHWJNJSIUnkuFp5NJKvMIXeUrefkGB1myvxIw";
const CLIENT_SECRET =
  "FB591165951E406DEFE30DAE866241F97144E195CE6157E72EC1D7FAEEBC19C8";
const REDIRECT_URI = "https://katman.io/appscript/callback";
const TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";
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
};
