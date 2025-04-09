// middleware/auth.js (for protected routes)
const jwt = require("jsonwebtoken");
const config = require("../config/jwtConfig");

module.exports = function (req, res, next) {
  // Get token from header
  const token =
    req.header("x-auth-token") ||
    req.header("Authorization")?.replace("Bearer ", "");

  // Check if no token
  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: "No token, authorization denied" });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    res
      .status(401)
      .json({ success: false, error: "Token is not valid or expired" });
  }
};
