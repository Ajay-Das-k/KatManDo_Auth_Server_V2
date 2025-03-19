const express = require("express");
const router = express.Router();
const serverController = require("../controller/serverController");

// Home Route – Render EJS Page
router.get("/", serverController.renderHomePage);

// Example of another GUI-related route
router.get("/gui", serverController.renderGuiPage);

module.exports = router;
