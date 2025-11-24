const controller = require("../controllers/authController");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");

// Mock toàn bộ
jest.mock("../models/User", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findAndCountAll: jest.fn(),
}));

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
}));

describe("UserController", () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {} };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
  });

  // =============================
  //  REGISTER
  // =============================
  describe("register()", () => {
    test("400 nếu username trống", async () => {
      req.body = { username: "", password: "Aa@123", role: "staff" };

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Tên đăng nhập phải từ 3 đến 20 ký tự",
      });
    });

    test("400 nếu username < 3 ký tự", async () => {
      req.body = { username: "ab", password: "Aa@123", role: "admin" };

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("400 nếu password trống", async () => {
      req.body = { username: "validUser", password: "" };

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Mật khẩu không được để trống",
      });
    });

    test("400 nếu password không đúng pattern", async () => {
      req.body = { username: "validUser", password: "abc123" };

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toMatch("Mật khẩu phải có");
    });

    test("400 nếu user đã tồn tại", async () => {
      req.body = { username: "userA", password: "Aa@123" };

      User.findOne.mockResolvedValue({ UserID: 1 });

      await controller.register(req, res);

      expect(User.findOne).toHaveBeenCalledWith({
        where: { Username: "userA" },
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Người dùng đã tồn tại",
      });
    });

    test("tạo user thành công", async () => {
      req.body = { username: "newuser", password: "Aa@123!", role: "admin" };

      User.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue("hashedPassword");

      User.create.mockResolvedValue({
        UserID: 10,
        Username: "newuser",
        Role: "admin",
      });

      await controller.register(req, res);

      expect(bcrypt.hash).toHaveBeenCalled();
      expect(User.create).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        message: "Đăng ký thành công",
        user: {
          id: 10,
          username: "newuser",
          role: "admin",
        },
      });
    });

    test("500 nếu throw exception", async () => {
      req.body = { username: "abc", password: "Aa@123!" };

      User.findOne.mockRejectedValue(new Error("DB Error"));

      await controller.register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Lỗi server" });
    });
  });

  // =============================
  //  LOGIN
  // =============================
  describe("login()", () => {
    test("400 nếu user không tồn tại", async () => {
      req.body = { username: "abc", password: "123" };

      User.findOne.mockResolvedValue(null);

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Tài khoản không tồn tại!",
      });
    });

    test("400 nếu password sai", async () => {
      req.body = { username: "abc", password: "wrongpass" };

      User.findOne.mockResolvedValue({
        UserID: 1,
        Username: "abc",
        Password: "hashed",
      });

      bcrypt.compare.mockResolvedValue(false);

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: "Sai tài khoản hoặc mật khẩu!",
      });
    });

    test("login thành công", async () => {
      req.body = { username: "abc", password: "Correct@123" };

      User.findOne.mockResolvedValue({
        UserID: 1,
        Username: "abc",
        Password: "hashed",
        Role: "admin",
      });

      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("jwt_token");

      await controller.login(req, res);

      expect(jwt.sign).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        message: "Logged in",
        token: "jwt_token",
        user: { id: 1, username: "abc", role: "admin" },
      });
    });

    test("500 nếu throw error", async () => {
      User.findOne.mockRejectedValue(new Error("DB Error"));

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Server error" });
    });
  });

  // =============================
  //  GET ALL USERS
  // =============================
  describe("getAllUsers()", () => {
    test("lấy danh sách users", async () => {
      req.query = { page: 2, limit: 5, search: "a" };

      User.findAndCountAll.mockResolvedValue({
        rows: [{ UserID: 1, Username: "admin" }],
        count: 1,
      });

      await controller.getAllUsers(req, res);

      expect(User.findAndCountAll).toHaveBeenCalledWith({
        where: { Username: { [Op.like]: "%a%" } },
        offset: 5,
        limit: 5,
        order: [["UserID", "DESC"]],
      });

      expect(res.json).toHaveBeenCalledWith({
        items: [{ UserID: 1, Username: "admin" }],
        totalItems: 1,
        totalPages: 1,
        currentPage: 2,
      });
    });

    test("500 nếu lỗi database", async () => {
      User.findAndCountAll.mockRejectedValue(new Error("DB Error"));

      await controller.getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: "Server error" });
    });
  });
});
