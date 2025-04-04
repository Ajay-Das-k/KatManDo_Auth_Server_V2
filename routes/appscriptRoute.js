const express = require("express");
const router = express.Router();
const appScriptController = require("../controller/appScriptController");

// Define routes for AppScript

router.post("/userRegister", appScriptController.userRegister); 
router.post("/createToken", appScriptController.createAccessToken);
router.post("/deleteToken", appScriptController.deleteAccessToken);
router.get("/callback", appScriptController.callbackToken);
router.get("/access-tokens", appScriptController.getAccessTokens);
router.post("/create-version", appScriptController.createVersion);
router.get("/getAllVersions", appScriptController.getAllVersions);
router.post("/checkVersion", appScriptController.checkVersion);



module.exports = router;

