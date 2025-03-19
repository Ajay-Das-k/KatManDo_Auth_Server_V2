const express = require("express");
const router = express.Router();
const appScriptController = require("../controller/appScriptController");

// Define routes for AppScript
router.get("/auth", appScriptController.authenticate); // Example route for AppScript authentication
router.post("/data", appScriptController.sendData); // Example route to send data to AppScript

module.exports = router;
