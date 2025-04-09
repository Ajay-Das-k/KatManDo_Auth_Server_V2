const express = require("express");
const router = express.Router();
const appScriptController = require("../controller/appScriptController");
const auth = require("../middleware/authentication");

// Define routes for AppScript

// @route   POST /api/auth/login
// @desc    Log in user or create new account
// @access  Public
router.post("/login", appScriptController.login);
// @route   GET /api/auth/user
// @desc    Get current user details and access tokens
// @access  Private (requires authentication)
router.get("/user", auth, appScriptController.getUserDetails);
// @route   GET /api/salesforce/object/:objectName
// @desc    Fetch data for a specific Salesforce object using stored access token
// @access  Private (requires authentication)
router.get(
  "/object/:objectName",auth,appScriptController.getSalesforceObject
);
// @route   POST /appscript/salesforce/query
// @desc    Execute a custom SOQL query on Salesforce
// @access  Private (requires authentication)
router.post(
  "/query",auth,appScriptController.executeSalesforceQuery
);


router.post("/userRegister", appScriptController.userRegister); 
router.post("/createToken", appScriptController.createAccessToken);
router.post("/deleteToken", appScriptController.deleteAccessToken);
router.get("/callback", appScriptController.callbackToken);
router.get("/access-tokens", appScriptController.getAccessTokens);
router.post("/create-version", appScriptController.createVersion);
router.get("/getAllVersions", appScriptController.getAllVersions);
router.post("/checkVersion", appScriptController.checkVersion);




module.exports = router;

