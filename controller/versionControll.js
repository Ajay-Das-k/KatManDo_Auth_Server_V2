// Libraries

const AppVersion = require("../models/appVersion");





const createVersion = async (req, res) => {
  try {
    // Check if version already exists
    const existingVersion = await AppVersion.findOne({
      versionNumber: req.body.versionNumber,
    });

    if (existingVersion) {
      return res.status(409).json({
        success: false,
        message: "Version with this number already exists",
      });
    }

    // Create new version document
    const newVersion = new AppVersion(req.body);

    // Save the version to database
    const savedVersion = await newVersion.save();

    res.status(201).json({
      success: true,
      message: "Version created successfully",
      data: savedVersion,
    });
  } catch (error) {
    console.error("Error creating version:", error);
    res.status(500).json({
      success: false,
      message: "Error creating version",
      error: error.message,
    });
  }
};

const getAllVersions = async (req, res) => {
  try {
    const versions = await AppVersion.find().sort({ releaseDate: -1 });
    res.status(200).json({
      success: true,
      count: versions.length,
      data: versions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching versions",
      error: error.message,
    });
  }
};

const checkVersion = async (req, res) => {
  try {
    // Get the version number from request body
    const { versionNumber } = req.body;

    if (!versionNumber) {
      return res.status(400).json({
        success: false,
        message: "Version number is required",
      });
    }

    // Find the latest version in the database
    // Use versionNumber for sorting instead of releaseDate to get the semantically highest version
    const allVersions = await AppVersion.find({ isStable: true });

    if (allVersions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No versions found in database",
      });
    }

    // Sort versions semantically to find the latest one
    allVersions.sort((a, b) => {
      return compareVersions(b.versionNumber, a.versionNumber);
    });

    const latestVersion = allVersions[0];

    // Debug logging - remove in production
    console.log(
      `Comparing user version: ${versionNumber} with latest version: ${latestVersion.versionNumber}`
    );

    // Compare versions
    const comparison = compareVersions(
      versionNumber,
      latestVersion.versionNumber
    );
    console.log(`Comparison result: ${comparison}`);

    const isUpToDate = comparison >= 0;

    if (isUpToDate) {
      return res.status(200).json({
        success: true,
        message: "Version is up to date",
        isUpToDate: true,
        currentVersion: versionNumber,
        latestVersion: latestVersion.versionNumber,
        environment: latestVersion.environment,
      });
    } else {
      return res.status(200).json({
        success: true,
        message: "Version is not up to date",
        isUpToDate: false,
        currentVersion: versionNumber,
        latestVersion: latestVersion.versionNumber,
        updateRequired: true,
        latestVersionInfo: {
          versionNumber: latestVersion.versionNumber,
          releaseDate: latestVersion.releaseDate,
          description: latestVersion.description,
          environment: latestVersion.environment,
        },
      });
    }
  } catch (error) {
    console.error("Error checking version:", error);
    res.status(500).json({
      success: false,
      message: "Error checking version",
      error: error.message,
    });
  }
};

// Improved version comparison function
function compareVersions(version1, version2) {
  // Split versions into parts and convert to numbers
  const parts1 = version1.split(".").map((part) => parseInt(part, 10));
  const parts2 = version2.split(".").map((part) => parseInt(part, 10));

  // Compare each part
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    // If parts1 has fewer components than parts2, treat missing parts as 0
    const v1 = i < parts1.length ? parts1[i] : 0;
    // If parts2 has fewer components than parts1, treat missing parts as 0
    const v2 = i < parts2.length ? parts2[i] : 0;

    if (v1 > v2) return 1;
    if (v1 < v2) return -1;
  }

  // If we get here, the versions are equal
  return 0;
}
module.exports = {
  createVersion,
  getAllVersions,
  checkVersion,
};
