const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Register và Login
router.post("/register", authController.register);
router.post("/login", authController.login);

// Lấy danh sách user, có tìm kiếm và phân trang
router.get("/users", authController.getAllUsers);

module.exports = router;
