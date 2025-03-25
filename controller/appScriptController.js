const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const AccessToken = require("../models/accessTokenModel");


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
     // Log incoming request details
     console.log("Received callback with query params:", req.query);

     // Get the authorization code and state from Salesforce
     const code = req.query.code;
     const state = req.query.state;

     if (!code) {
       console.error("Authorization code missing");
       return res.status(400).send("Authorization code missing");
     }

     // Extract scriptId from state token
     let scriptId = "";
     try {
       if (state) {
         console.log("Full state parameter:", state);

         // The state is a more complex token created by Apps Script
         // Try to parse the scriptId from the state URL
         if (state.includes("scriptId=")) {
           const match = state.match(/scriptId=([^&]+)/);
           if (match && match[1]) {
             scriptId = decodeURIComponent(match[1]);
             console.log("Extracted scriptId from state parameter:", scriptId);
           }
         } else if (state.includes("=")) {
           // Try to parse as URL query params
           const params = new URLSearchParams(state);
           scriptId = params.get("scriptId");
           if (scriptId) {
             console.log("Extracted scriptId from URLSearchParams:", scriptId);
           }
         } else {
           // If it doesn't contain a scripdId= part and doesn't look like
           // URL parameters, assume the state itself is the scriptId
           scriptId = state;
           console.log("Using state directly as scriptId:", scriptId);
         }

         if (!scriptId) {
           console.error("Could not extract scriptId from state token");
           return res
             .status(400)
             .send("Could not extract scriptId from state token");
         }
       } else {
         console.error("State parameter missing");
         return res.status(400).send("State parameter missing");
       }
     } catch (error) {
       console.error("Error extracting scriptId:", error);
       return res.status(500).send(`
        <h2>Error Extracting Script ID</h2>
        <p>Could not extract the Script ID from the state parameter.</p>
        <p>State parameter: ${state}</p>
        <p>Error: ${error.message}</p>
      `);
     }

     // Construct the Apps Script callback URL
     const appScriptUrl = `https://script.google.com/macros/d/${scriptId}/usercallback`;

     // Pass the authorization code and state to Apps Script
     const redirectUrl = `${appScriptUrl}?code=${encodeURIComponent(
       code
     )}&state=${encodeURIComponent(state)}`;

     console.log("Redirecting to Apps Script URL:", redirectUrl);

     // Show debug info before redirecting
     res.send(`
      <html>
      <head>
        <title>Redirecting to Google Apps Script</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
          .success { color: green; }
          button { padding: 10px; background: #4285f4; color: white; border: none; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>Authentication Successful!</h2>
        <p class="success">✓ Ready to connect to Google Apps Script</p>
        <p>Click the button below to continue:</p>
        
        <p><button onclick="window.location.href='${redirectUrl}'">Continue to Google Apps Script</button></p>
        
        <h3>Debug Information:</h3>
        <p>Script ID: ${scriptId}</p>
        <p>State Token: ${state}</p>
        
        <details>
          <summary>View Full Redirect URL</summary>
          <pre>${redirectUrl}</pre>
        </details>
        
        <script>
          // Automatically redirect after 5 seconds
          setTimeout(function() {
            window.location.href = '${redirectUrl}';
          }, 5000);
        </script>
      </body>
      </html>
    `);
   } catch (error) {
     console.error("Error in OAuth callback:", error);
     let errorDetails = "No additional details available";

     if (error.response) {
       errorDetails = `Status: ${error.response.status}, Data: ${JSON.stringify(
         error.response.data
       )}`;
       console.error("Response error details:", errorDetails);
     }

     res.status(500).send(`
      <html>
      <head>
        <title>OAuth Error</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .error { color: red; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <h2 class="error">Error Processing OAuth Callback</h2>
        <p>${error.message}</p>
        
        <details>
          <summary>Technical Details</summary>
          <pre>${errorDetails}</pre>
        </details>
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




(module.exports = {
  userRegister,
  createAccessToken,
  deleteAccessToken,
  callbackToken,
});
