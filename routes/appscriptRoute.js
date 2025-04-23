const express = require("express");
const router = express.Router();
const appScriptController = require("../controller/appScriptController");
const auth = require("../middleware/authentication");

// Define routes for AppScript

// @route   POST /api/auth/login
// @desc    Log in user or create new account
// @access  Public
router.post("/login", appScriptController.login);

// @route   POST /appscript/salesforce/query
// @desc    Execute a custom SOQL query on Salesforce
// @access  Private (requires authentication)
router.post("/query", auth, appScriptController.executeSalesforceQuery);


router.get("/userinfo",auth,appScriptController.getSalesforceUserInfo);



// @route   GET /appscript/deleteToken
// @desc    Delete or revoke a user's access token
// @access  Private
router.get("/deleteToken", auth, appScriptController.deleteAccessToken);



// @route   GET /appscript/salesforce/objects
// @desc    Get all Salesforce objects
// @access  Private (requires authentication)
router.get("/objects", auth, appScriptController.getSalesforceObjects);



// @route   GET /appscript/callback
// @desc    Handle OAuth callback for token retrieval
// @access  Public
router.get("/callback", appScriptController.callbackToken);








module.exports = router;

