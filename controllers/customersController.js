const Customer = require("../models/Customer");
const { Op } = require("sequelize");

// ======================== CREATE ========================
exports.create = async (req, res) => {
  try {
    const { FullName, Phone, Email, Address } = req.body;

    const trimmedName = FullName ? FullName.trim() : "";
    const trimmedPhone = Phone ? Phone.trim() : "";

    // --- Validate tên ---
    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên khách hàng không được để trống." });
    }

    // --- Validate phone ---
    if (!trimmedPhone) {
      return res
        .status(400)
        .json({ message: "Số điện thoại không được để trống." });
    }

    // Kiểm tra định dạng SDT (chỉ số, 9–11 ký tự)
    const phoneRegex = /^[0-9]{9,11}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ (chỉ gồm số, 9–11 ký tự).",
      });
    }

    // --- Chuẩn hóa email ---
    const trimmedEmail =
      Email === "" || Email === undefined ? null : Email.trim();

    // --- Validate email nếu có ---
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
          message: "Email không hợp lệ.",
        });
      }
    }

    // --- Check trùng phone ---
    const existPhone = await Customer.findOne({
      where: { Phone: trimmedPhone },
    });

    if (existPhone) {
      return res.status(400).json({
        message: "Số điện thoại đã tồn tại.",
      });
    }

    // --- Check trùng email nếu có ---
    if (trimmedEmail) {
      const existEmail = await Customer.findOne({
        where: { Email: trimmedEmail },
      });

      if (existEmail) {
        return res.status(400).json({
          message: "Email đã tồn tại.",
        });
      }
    }

    // --- Create Customer ---
    const customer = await Customer.create({
      FullName: trimmedName,
      Phone: trimmedPhone,
      Email: trimmedEmail,
      Address,
    });

    res.json({ message: "Created", customer });
  } catch (err) {
    console.error("Lỗi tạo Customer:", err);

    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: err.errors[0].message || "Lỗi dữ liệu không hợp lệ.",
      });
    }

    if (err.name === "SequelizeUniqueConstraintError") {
      return res
        .status(400)
        .json({ message: "Số điện thoại hoặc email đã tồn tại." });
    }

    res.status(500).json({ message: "Server error" });
  }
};

// ======================== LIST ========================
exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { FullName: { [Op.like]: `%${search}%` } },
        { Phone: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await Customer.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [["CustomerID", "DESC"]],
    });

    res.json({
      items: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("Lỗi list Customer:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================== GET BY ID ========================
exports.get = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ message: "Not found" });

    res.json(customer);
  } catch (err) {
    console.error("Lỗi get Customer:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================== UPDATE ========================
exports.update = async (req, res) => {
  try {
    const { FullName, Phone, Email, Address } = req.body;

    const trimmedName = FullName ? FullName.trim() : "";
    const trimmedPhone = Phone ? Phone.trim() : "";
    const trimmedEmail = Email ? Email.trim() : "";

    // ===== Validate Name =====
    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên khách hàng không được để trống." });
    }

    // ===== Validate Phone =====
    if (!trimmedPhone) {
      return res
        .status(400)
        .json({ message: "Số điện thoại không được để trống." });
    }

    // ===== Find Customer =====
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy Customer" });
    }

    // ===== Check duplicated Phone =====
    if (trimmedPhone !== customer.Phone) {
      const existPhone = await Customer.findOne({
        where: { Phone: trimmedPhone },
      });

      if (existPhone && existPhone.CustomerID !== customer.CustomerID) {
        return res.status(400).json({ message: "Số điện thoại đã tồn tại." });
      }
    }

    // ===== Check duplicated Email (nếu có nhập email) =====
    if (trimmedEmail && trimmedEmail !== customer.Email) {
      const existEmail = await Customer.findOne({
        where: { Email: trimmedEmail },
      });

      if (existEmail && existEmail.CustomerID !== customer.CustomerID) {
        return res.status(400).json({ message: "Email đã tồn tại." });
      }
    }

    // ===== Update =====
    customer.FullName = trimmedName;
    customer.Phone = trimmedPhone;
    customer.Email = trimmedEmail || null;
    customer.Address = Address;

    await customer.save();

    res.json({ message: "Updated", customer });
  } catch (err) {
    console.error("Lỗi cập nhật Customer:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ message: "Dữ liệu trùng lặp." });
    }

    res.status(500).json({ message: "Server error" });
  }
};
