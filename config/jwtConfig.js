// config/config.js
module.exports = {

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiration: process.env.JWT_EXPIRATION || "24h",
};
