const express = require("express");
const router = express.Router();
const appScriptController = require("../controller/appScriptController");

// Define routes for AppScript
router.get("/auth", appScriptController.authenticate); //  route for AppScript authentication
router.post("/data", appScriptController.sendData); //  route to send data to AppScript
router.get("/env-data", appScriptController.environmentData); //  route to send environmentData to AppScript

module.exports = router;
