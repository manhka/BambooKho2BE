const Category = require("../models/Category");
const { Op } = require("sequelize");

exports.create = async (req, res) => {
  try {
    const { Name, Description } = req.body;

    const trimmedName = Name ? Name.trim() : Name;

    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên danh mục không được để trống." });
    }

    const exist = await Category.findOne({ where: { Name: trimmedName } });
    if (exist) {
      return res
        .status(400)
        .json({ message: "Tên danh mục đã tồn tại. Vui lòng chọn tên khác." });
    }

    const category = await Category.create({
      Name: trimmedName,
      Description: Description,
      Status: "active",
    });

    res.json({ message: "Created", category });
  } catch (err) {
    console.error("Lỗi tạo Category:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "Tên danh mục đã tồn tại. Vui lòng chọn tên khác.",
      });
    }

    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: err.errors[0].message || "Lỗi dữ liệu không hợp lệ.",
      });
    }

    res.status(500).json({ message: "Server error" });
  }
};

exports.list = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status } = req.query;

    const where = {};

    if (search) {
      where.Name = { [Op.like]: `%${search}%` };
    }

    if (status) where.Status = status;

    const offset = (page - 1) * limit;

    const { rows, count } = await Category.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [["CategoryID", "DESC"]],
    });

    res.json({
      items: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.get = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });

    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.update = async (req, res) => {
  try {
    const { Name, Description } = req.body;

    const trimmedName = Name ? Name.trim() : Name;

    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên danh mục không được để trống." });
    }

    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Không tìm thấy Category" });
    }

    if (trimmedName !== category.Name) {
      const exist = await Category.findOne({ where: { Name: trimmedName } });
      if (exist && exist.CategoryID !== category.CategoryID) {
        return res.status(400).json({
          message: "Tên danh mục đã tồn tại. Vui lòng chọn tên khác.",
        });
      }
    }

    category.Name = trimmedName;
    category.Description = Description;

    await category.save();

    res.json({ message: "Updated", category });
  } catch (err) {
    console.error("Lỗi cập nhật Category:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "Tên danh mục đã tồn tại. Vui lòng chọn tên khác.",
      });
    }

    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: err.errors[0].message || "Lỗi dữ liệu không hợp lệ.",
      });
    }

    res.status(500).json({ message: "Server error" });
  }
};

exports.archive = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });

    category.Status = "archived";
    await category.save();

    res.json({ message: "Archived", category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.restore = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });

    category.Status = "active";
    await category.save();

    res.json({ message: "Restored", category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
