const Supplier = require("../models/Supplier");
const { Op } = require("sequelize");

// ======================== CREATE ========================
exports.create = async (req, res) => {
  try {
    const { Name, Phone, Email, Address, ContactPerson, Note } = req.body;

    const trimmedName = Name ? Name.trim() : "";

    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên nhà cung cấp không được để trống." });
    }

    const supplier = await Supplier.create({
      Name: trimmedName,
      Phone,
      Email,
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

    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên nhà cung cấp không được để trống." });
    }

    const supplier = await Supplier.findByPk(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Không tìm thấy Supplier" });
    }

    supplier.Name = trimmedName;
    supplier.Phone = Phone;
    supplier.Email = Email;
    supplier.Address = Address;
    supplier.ContactPerson = ContactPerson;
    supplier.Note = Note;

    await supplier.save();

    res.json({ message: "Updated", supplier });
  } catch (err) {
    console.error("Lỗi cập nhật Supplier:", err);

    res.status(500).json({ message: "Server error" });
  }
};
