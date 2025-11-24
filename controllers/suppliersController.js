const Supplier = require("../models/Supplier");
const { Op } = require("sequelize");

// ======================== CREATE ========================
exports.create = async (req, res) => {
  try {
    const { Name, Phone, Email, Address, ContactPerson, Note } = req.body;

    const trimmedName = Name ? Name.trim() : "";

    // --- Validate tên ---
    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên nhà cung cấp không được để trống." });
    }

    // --- Validate phone ---
    const trimmedPhone = Phone ? Phone.trim() : "";

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

    // --- Chuẩn hoá email ---
    const trimmedEmail =
      Email === "" || Email === undefined ? null : Email.trim();

    // --- Check email hợp lệ nếu có nhập ---
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
          message: "Email không hợp lệ.",
        });
      }
    }

    // --- Check trùng số điện thoại ---
    const existedPhone = await Supplier.findOne({
      where: { Phone: trimmedPhone },
    });

    if (existedPhone) {
      return res.status(400).json({
        message: "Số điện thoại đã tồn tại.",
      });
    }

    // --- Check trùng email (nếu có email) ---
    if (trimmedEmail) {
      const existedEmail = await Supplier.findOne({
        where: { Email: trimmedEmail },
      });

      if (existedEmail) {
        return res.status(400).json({
          message: "Email đã tồn tại.",
        });
      }
    }

    // --- Create Supplier ---
    const supplier = await Supplier.create({
      Name: trimmedName,
      Phone: trimmedPhone,
      Email: trimmedEmail,
      Address,
      ContactPerson,
      Note,
    });

    res.json({ message: "Created", supplier });
  } catch (err) {
    console.error("Lỗi tạo Supplier:", err);

    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: err.errors[0].message || "Lỗi dữ liệu không hợp lệ.",
      });
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
        { Name: { [Op.like]: `%${search}%` } },
        { Phone: { [Op.like]: `%${search}%` } },
        { Email: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (page - 1) * limit;

    const { rows, count } = await Supplier.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [["SupplierID", "DESC"]],
    });

    res.json({
      items: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("Lỗi list Supplier:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================== GET BY ID ========================
exports.get = async (req, res) => {
  try {
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) return res.status(404).json({ message: "Not found" });

    res.json(supplier);
  } catch (err) {
    console.error("Lỗi get Supplier:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================== UPDATE ========================

exports.update = async (req, res) => {
  try {
    const { Name, Phone, Email, Address, ContactPerson, Note } = req.body;

    const trimmedName = Name ? Name.trim() : "";

    // --- Validate tên ---
    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên nhà cung cấp không được để trống." });
    }

    // --- Validate phone ---
    const trimmedPhone = Phone ? Phone.trim() : "";

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

    // --- Lấy Supplier ---
    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Không tìm thấy Supplier" });
    }

    // --- Check trùng số điện thoại với bản ghi khác ---
    const existedPhone = await Supplier.findOne({
      where: {
        Phone: trimmedPhone,
        SupplierID: { [Op.ne]: req.params.id }, // khác id hiện tại
      },
    });

    if (existedPhone) {
      return res.status(400).json({
        message: "Số điện thoại đã tồn tại.",
      });
    }

    // --- Chuẩn hóa email ---
    const fixedEmail =
      Email === "" || Email === undefined ? null : Email.trim();

    // --- Validate email nếu có ---
    if (fixedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(fixedEmail)) {
        return res.status(400).json({ message: "Email không hợp lệ." });
      }
    }

    // --- Check trùng email với bản ghi khác ---
    if (fixedEmail) {
      const existedEmail = await Supplier.findOne({
        where: {
          Email: fixedEmail,
          SupplierID: { [Op.ne]: req.params.id },
        },
      });

      if (existedEmail) {
        return res.status(400).json({
          message: "Email đã tồn tại.",
        });
      }
    }

    // --- Update fields ---
    supplier.Name = trimmedName;
    supplier.Phone = trimmedPhone;
    supplier.Email = fixedEmail;
    supplier.Address = Address;
    supplier.ContactPerson = ContactPerson;
    supplier.Note = Note;

    await supplier.save();

    res.json({ message: "Updated", supplier });
  } catch (err) {
    console.error("Lỗi cập nhật Supplier:", err);

    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: err.errors[0].message || "Dữ liệu không hợp lệ.",
      });
    }

    res.status(500).json({ message: "Server error" });
  }
};
