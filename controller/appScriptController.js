const asyncHandler = require("express-async-handler");
const User = require("../models/userModel"); // Import the User model

const authenticate = asyncHandler(async (req, res) => {
  // Logic for authenticating AppScript (e.g., async API call)
  res.send("AppScript Authentication Route");
});

// Function to handle user registration
const userRegister = async (req, res) => {
    const { username, email, password, firstName, lastName, role } = req.body;

    // Validate input fields
    if (!username || !email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: 'All fields are required!' });
    }

    // Check if the user already exists by username or email
    try {
        const existingUser = await User.findOne({
          $or: [{ googleSheetId: googleSheetId }, { email: email }],
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists!' });
        }

        // Create a new user
        const newUser = new User({
          googleSheetId,
          email
         //  password, // You should hash the password before saving it, more on that below
         //  firstName,
         //  lastName,
         //  role: role || "user", // default to 'user' if role is not provided
        });

        // Save the user to the database
        const savedUser = await newUser.save();

        // Send success response
        res.status(201).json({
          message: "User registered successfully!",
          user: {
            googleSheetId: savedUser.googleSheetId,
            email: savedUser.email,
          },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

const environmentData = asyncHandler(async (req, res) => {
  const envData = {
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    REDIRECT_URI: process.env.REDIRECT_URI,
    AUTH_URL: process.env.AUTH_URL,
    TOKEN_URL: process.env.TOKEN_URL,
  };
  res.json(envData); // Responding with the environment data
});

module.exports = { authenticate, userRegister, environmentData };
