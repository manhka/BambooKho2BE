const Brand = require("../models/Brand");
const { Op } = require("sequelize");

exports.create = async (req, res) => {
  try {
    const { Name, Description } = req.body;

    const trimmedName = Name ? Name.trim() : Name;

    if (!trimmedName) {
      return res
        .status(400)
        .json({ message: "Tên thương hiệu không được để trống." });
    }

    const exist = await Brand.findOne({ where: { Name: trimmedName } });
    if (exist) {
      return res.status(400).json({
        message: "Tên thương hiệu đã tồn tại. Vui lòng chọn tên khác.",
      });
    }

    const brand = await Brand.create({
      Name: trimmedName,
      Description: Description,
      Status: "active",
    });

    res.json({ message: "Created", brand });
  } catch (err) {
    console.error("Lỗi tạo Brand:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "Tên thương hiệu đã tồn tại. Vui lòng chọn tên khác.",
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

    const { rows, count } = await Brand.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [["BrandID", "DESC"]],
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
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) return res.status(404).json({ message: "Not found" });

    res.json(brand);
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
        .json({ message: "Tên thương hiệu không được để trống." });
    }

    const brand = await Brand.findByPk(req.params.id);
    if (!brand) {
      return res.status(404).json({ message: "Không tìm thấy Brand" });
    }

    if (trimmedName !== brand.Name) {
      const exist = await Brand.findOne({ where: { Name: trimmedName } });
      if (exist && exist.BrandID !== brand.BrandID) {
        return res.status(400).json({
          message: "Tên thương hiệu đã tồn tại. Vui lòng chọn tên khác.",
        });
      }
    }

    brand.Name = trimmedName;
    brand.Description = Description;

    await brand.save();

    res.json({ message: "Updated", brand });
  } catch (err) {
    console.error("Lỗi cập nhật Brand:", err);

    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "Tên thương hiệu đã tồn tại. Vui lòng chọn tên khác.",
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
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) return res.status(404).json({ message: "Not found" });

    brand.Status = "archived";
    await brand.save();

    res.json({ message: "Archived", brand });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.restore = async (req, res) => {
  try {
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) return res.status(404).json({ message: "Not found" });

    brand.Status = "active";
    await brand.save();

    res.json({ message: "Restored", brand });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
