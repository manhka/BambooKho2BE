const Category = require("../models/Category");

// Create new category
exports.create = async (req, res) => {
  try {
    const { name, description } = req.body;

    const exist = await Category.findOne({ where: { Name: name } });
    if (exist) return res.status(400).json({ message: "Category exists" });

    const category = await Category.create({
      Name: name,
      Description: description,
      Status: "active",
    });

    res.json({ message: "Created", category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// List all categories (optional: filter by status)
exports.list = async (req, res) => {
  try {
    const status = req.query.status; // ?status=active or archived
    const where = status ? { Status: status } : {};

    const categories = await Category.findAll({ where });
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get one category by ID
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

// Update category
exports.update = async (req, res) => {
  try {
    const { name, description } = req.body;

    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ message: "Not found" });

    category.Name = name;
    category.Description = description;
    await category.save();

    res.json({ message: "Updated", category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Archive (soft delete)
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

// Restore archived category
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
