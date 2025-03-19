// appScriptController.js

exports.authenticate = (req, res) => {
  // Logic for authenticating AppScript
  res.send("AppScript Authentication Route");
};

exports.sendData = (req, res) => {
  // Logic for sending data to AppScript
  const requestData = req.body;
  res.send("Data sent to AppScript");
};
