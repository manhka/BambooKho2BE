const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
require("dotenv").config();

// Register
exports.register = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validate username
    if (!username || username.length < 3 || username.length > 20) {
      return res
        .status(400)
        .json({ message: "Tên đăng nhập phải từ 3 đến 20 ký tự" });
    }

    // Validate password
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{6,}$/;
    if (!password) {
      return res.status(400).json({ message: "Mật khẩu không được để trống" });
    }
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Mật khẩu phải có ít nhất 6 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt",
      });
    }

    // Validate role
    const validRoles = ["admin", "staff"];
    const userRole =
      role && validRoles.includes(role.toLowerCase())
        ? role.toLowerCase()
        : "staff";

    // Kiểm tra user tồn tại
    const existingUser = await User.findOne({ where: { Username: username } });
    if (existingUser)
      return res.status(400).json({ message: "Người dùng đã tồn tại" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo user mới
    const newUser = await User.create({
      Username: username,
      Password: hashedPassword,
      Role: userRole,
    });

    return res.json({
      message: "Đăng ký thành công",
      user: {
        id: newUser.UserID,
        username: newUser.Username,
        role: newUser.Role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ where: { Username: username } });
    if (!user)
      return res.status(400).json({ message: "Tài khoản không tồn tại!" });

    const match = await bcrypt.compare(password, user.Password);
    if (!match)
      return res.status(400).json({ message: "Sai tài khoản hoặc mật khẩu!" });

    const token = jwt.sign(
      { id: user.UserID, role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES }
    );

    return res.json({
      message: "Logged in",
      token,
      user: { id: user.UserID, username: user.Username, role: user.Role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};
