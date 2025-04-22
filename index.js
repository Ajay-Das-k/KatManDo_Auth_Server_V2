const dotenv = require("dotenv").config();
const PORT = process.env.PORT || 3000;
const morgan = require("morgan");
const express = require("express");
const path = require("path");
const dbConnect = require("./config/dbConnect");

const app = express();
dbConnect.dbConnect();
app.use(express.json());
// Set EJS as view engine
app.set("view engine", "ejs");

// Set views directory (optional if it's default)
app.set("views", path.join(__dirname, "views"));

// Serve static files like images
app.use(express.static(path.join(__dirname, "public")));

app.use(morgan("dev"));

// Import Routes
const appscriptRoute = require("./routes/appscriptRoute");
const serverGuiRoute = require("./routes/serverGuiRoute");
const versionRoute = require("./routes/versionRoute");

// Use Routes
app.use("/appscript", appscriptRoute); // Handle Appscript specific API logic
app.use("/version", versionRoute); // Handle Appscript specific API logic
app.use("/", serverGuiRoute); // Handle Server GUI related routes

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
