const express = require("express");
const router = express.Router();
const versionController = require("../controller/versionControll")
const auth = require("../middleware/authentication");
// @route   POST /appscript/create-version
// @desc    Create a new version record for the application
// @access  Private
router.post("/create-version", versionController.createVersion);

// @route   GET /appscript/getAllVersions
// @desc    Retrieve all available application versions
// @access  Public
router.get("/getAllVersions", versionController.getAllVersions);

// @route   POST /appscript/checkVersion
// @desc    Verify if a specific version exists or is compatible
// @access  Public
router.post("/checkVersion", versionController.checkVersion);
module.exports = router;
