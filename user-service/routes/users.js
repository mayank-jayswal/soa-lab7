const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/User");

// GET /users - List all users
router.get("/", async (req, res) => {
  try {
    const { role, department } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (department) filter.department = department;

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// GET /users/:id - Get single user by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: "Not Found",
        message: `User with id '${id}' not found (invalid ID format)`,
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: `User with id '${id}' not found`,
      });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// POST /users - Create a new user
router.post("/", async (req, res) => {
  try {
    const { name, email, role, department } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        error: "Bad Request",
        message: "name and email are required fields",
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        error: "Conflict",
        message: `User with email '${email}' already exists`,
      });
    }

    const user = new User({
      name,
      email,
      role: role || "student",
      department: department || "Computer Science",
    });

    await user.save();
    res.status(201).json(user);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: "Validation Error", message: err.message });
    }
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// PUT /users/:id - Update user by ID
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: "Not Found",
        message: `User with id '${id}' not found`,
      });
    }

    const updatedUser = await User.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({
        error: "Not Found",
        message: `User with id '${id}' not found`,
      });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: "Validation Error", message: err.message });
    }
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// DELETE /users/:id - Delete user by ID
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        error: "Not Found",
        message: `User with id '${id}' not found`,
      });
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({
        error: "Not Found",
        message: `User with id '${id}' not found`,
      });
    }

    res.status(200).json({
      message: `User with id '${id}' deleted successfully`,
      deletedUser,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

module.exports = router;
