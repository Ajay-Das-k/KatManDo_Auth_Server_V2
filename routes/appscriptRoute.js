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

// @route   GET /appscript/salesforce/userinfo
// @desc    Execute a custom SOQL query on Salesforce
// @access  Private (requires authentication)
router.get("/userinfo",auth,appScriptController.getSalesforceUserInfo);



// @route   GET /appscript/deleteToken
// @desc    Delete or revoke a user's access token
// @access  Private
router.get("/deleteToken", auth, appScriptController.deleteAccessToken);



// @route   GET /appscript/objects
// @desc    Get all Salesforce objects
// @access  Private (requires authentication)
router.get("/objects", auth, appScriptController.getSalesforceObjects);


// @route   POST /appscript/getObjectFields
// @desc    Get all Salesforce objects
// @access  Private (requires authentication)
router.post("/getObjectFields", auth, appScriptController.getObjectFields);


// @route   POST /appscript/insert
// @desc    Insert ObjetInto Salesforce
// @access  Private (requires authentication)
router.post("/insert", auth, appScriptController.insertSalesforceObject);

// @route   POST /appscript/upsert
// @desc    Upsert ObjetInto Salesforce
// @access  Private (requires authentication)
router.post("/upsert", auth, appScriptController.upsertSalesforceObject);

// @route   GET /appscript/callback
// @desc    Handle OAuth callback for token retrieval
// @access  Public
router.get("/callback", appScriptController.callbackToken);








module.exports = router;

