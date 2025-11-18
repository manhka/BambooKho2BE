const Brand = require("../models/Brand");

// Create new brand
exports.create = async (req, res) => {
  try {
    const { name, description } = req.body;

    const exist = await Brand.findOne({ where: { Name: name } });
    if (exist) return res.status(400).json({ message: "Brand exists" });

    const brand = await Brand.create({
      Name: name,
      Description: description,
      Status: "active",
    });

    res.json({ message: "Created", brand });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// List all brands (optional: filter by status)
exports.list = async (req, res) => {
  try {
    const status = req.query.status; // ?status=active or archived
    const where = status ? { Status: status } : {};

    const brands = await Brand.findAll({ where });
    res.json(brands);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get one brand by ID
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

// Update brand
exports.update = async (req, res) => {
  try {
    const { name, description } = req.body;

    const brand = await Brand.findByPk(req.params.id);
    if (!brand) return res.status(404).json({ message: "Not found" });

    brand.Name = name;
    brand.Description = description;
    await brand.save();

    res.json({ message: "Updated", brand });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Archive (soft delete)
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

// Restore archived brand
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
