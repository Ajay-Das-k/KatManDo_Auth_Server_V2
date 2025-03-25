const express = require("express");
const router = express.Router();
const appScriptController = require("../controller/appScriptController");

// Define routes for AppScript

router.post("/userRegister", appScriptController.userRegister); 
router.post("/createToken", appScriptController.createAccessToken);
router.post("/deleteToken", appScriptController.deleteAccessToken);
router.get("/callback", appScriptController.callbackToken);


module.exports = router;

