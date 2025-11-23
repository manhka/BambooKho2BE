const Customer = require("../models/Customer");
const { Op } = require("sequelize");

// ======================== CREATE ========================
exports.create = async (req, res) => {
  try {
    const { FullName, Phone, Email, Address } = req.body;

    const trimmedName = FullName ? FullName.trim() : "";
    const trimmedPhone = Phone ? Phone.trim() : "";

    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên khách hàng không được để trống." });
    }

    if (!trimmedPhone) {
      return res
        .status(400)
        .json({ message: "Số điện thoại không được để trống." });
    }

    const exist = await Customer.findOne({ where: { Phone: trimmedPhone } });
    if (exist) {
      return res.status(400).json({
        message: "Số điện thoại đã tồn tại.",
      });
    }

    const customer = await Customer.create({
      FullName: trimmedName,
      Phone: trimmedPhone,
      Email,
      Address,
    });

    res.json({ message: "Created", customer });
  } catch (err) {
    console.error("Lỗi tạo Customer:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ message: "Số điện thoại đã tồn tại." });
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

    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên khách hàng không được để trống." });
    }

    if (!trimmedPhone) {
      return res
        .status(400)
        .json({ message: "Số điện thoại không được để trống." });
    }

    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy Customer" });
    }

    // Kiểm tra trùng phone
    if (trimmedPhone !== customer.Phone) {
      const exist = await Customer.findOne({ where: { Phone: trimmedPhone } });
      if (exist && exist.CustomerID !== customer.CustomerID) {
        return res.status(400).json({ message: "Số điện thoại đã tồn tại." });
      }
    }

    customer.FullName = trimmedName;
    customer.Phone = trimmedPhone;
    customer.Email = Email;
    customer.Address = Address;

    await customer.save();

    res.json({ message: "Updated", customer });
  } catch (err) {
    console.error("Lỗi cập nhật Customer:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ message: "Số điện thoại đã tồn tại." });
    }

    res.status(500).json({ message: "Server error" });
  }
};
