// serverController.js

exports.renderHomePage = (req, res) => {
  res.render("home"); // Renders home.ejs
};

exports.renderGuiPage = (req, res) => {
  res.render("gui"); // Renders gui.ejs
};
