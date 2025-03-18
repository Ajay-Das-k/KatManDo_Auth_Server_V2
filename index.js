const dotenv = require("dotenv").config();
const PORT = process.env.PORT || 4000;
const morgan = require("morgan");
const express = require("express");
const path = require("path");

const app = express();

// Set EJS as view engine
app.set("view engine", "ejs");

// Set views directory (optional if it's default)
app.set("views", path.join(__dirname, "views"));

// Serve static files like images
app.use(express.static(path.join(__dirname, "public")));

app.use(morgan("dev"));

// Home Route – Render EJS Page
app.get("/", (req, res) => {
  res.render("home"); // Looks for views/home.ejs
});

// User Routes
const userRoute = require("./routes/userRoute");
app.use("/user", userRoute); // (optional: keep user APIs separated)

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
