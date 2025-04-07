const asyncHandler = require("express-async-handler");
// serverController.js

const renderHomePage = async (req, res) => {
  try {
    res.render("home"); // Renders home.ejs
  } catch (error) {
    res.status(500).send("Error rendering the home page");
  }
};

const renderGuiPage = async (req, res) => {
  try {
    res.render("gui"); // Renders gui.ejs
  } catch (error) {
    res.status(500).send("Error rendering the GUI page");
  }
};

module.exports = { renderHomePage, renderGuiPage };
