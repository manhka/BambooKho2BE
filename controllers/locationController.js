const { Op } = require("sequelize");
const { Location } = require("../models");

// ======================================================================
// GET ALL (LIST + SEARCH + PAGINATION + FILTER STATUS)
// ======================================================================
exports.getAll = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", status = "active" } = req.query;

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.max(parseInt(limit), 1);
    const offset = (pageNum - 1) * limitNum;

    // ------------------------------------------------------------------
    // WHERE CONDITION
    // ------------------------------------------------------------------
    const whereCondition = {};

    // 1️⃣ FILTER STATUS (Sử dụng trường Status của Model)
    // Model sử dụng Status: ENUM("active", "archive")
    if (status === "active") {
      whereCondition.Status = "active";
    } else if (status === "archive") {
      whereCondition.Status = "archive";
    }
    // 2️⃣ SEARCH BY CODE OR NAME (optional)
    if (search && search.trim() !== "") {
      const keyword = `%${search.trim()}%`;
      whereCondition[Op.or] = [
        { Code: { [Op.like]: keyword } },
        { Name: { [Op.like]: keyword } },
      ];
    }

    const { rows, count } = await Location.findAndCountAll({
      where: whereCondition,
      offset,
      limit: limitNum,
      order: [["Code", "ASC"]],
    });

    res.json({
      items: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limitNum),
      currentPage: pageNum,
    });
  } catch (err) {
    console.error("LỖI [LocationController:getAll]:", err);
    res.status(500).json({
      message: "Lỗi máy chủ khi lấy danh sách vị trí.",
      error: err.message,
    });
  }
};

// ======================================================================
// CREATE LOCATION
// ======================================================================
exports.create = async (req, res) => {
  try {
    const { Code, Name, Description, IsActive } = req.body;

    // 1️⃣ VALIDATION — CODE REQUIRED
    if (!Code || !Code.trim()) {
      return res.status(400).json({ message: "Mã vị trí (Code) là bắt buộc." });
    }

    // 2️⃣ VALIDATION — NAME REQUIRED
    if (!Name || !Name.trim()) {
      return res.status(400).json({ message: "Tên vị trí là bắt buộc." });
    }

    const trimmedCode = Code.trim();
    const trimmedName = Name.trim();

    // 3️⃣ CHECK TRÙNG MÃ
    const existCode = await Location.findOne({ where: { Code: trimmedCode } });
    if (existCode) {
      return res.status(400).json({
        message: `Mã vị trí "${trimmedCode}" đã tồn tại.`,
      });
    }

    // 4️⃣ CHECK TRÙNG TÊN
    const existName = await Location.findOne({ where: { Name: trimmedName } });
    if (existName) {
      return res.status(400).json({
        message: `Tên vị trí "${trimmedName}" đã tồn tại.`,
      });
    }

    // 5️⃣ CREATE
    const location = await Location.create({
      Code: trimmedCode,
      Name: trimmedName,
      Description: Description || null,
      IsActive: IsActive !== undefined ? IsActive : true,
    });

    res.status(201).json({
      message: "Tạo vị trí thành công.",
      location,
    });
  } catch (err) {
    console.error("LỖI [LocationController:create]:", err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
};

// ======================================================================
// UPDATE LOCATION
// ======================================================================
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { Code, Name, Description, IsActive } = req.body;

    // 1️⃣ VALIDATION — CODE REQUIRED
    if (!Code || !Code.trim()) {
      return res.status(400).json({ message: "Mã vị trí (Code) là bắt buộc." });
    }

    // 2️⃣ VALIDATION — NAME REQUIRED
    if (!Name || !Name.trim()) {
      return res.status(400).json({ message: "Tên vị trí là bắt buộc." });
    }

    const trimmedCode = Code.trim();
    const trimmedName = Name.trim();

    // 3️⃣ CHECK LOCATION EXISTS
    const location = await Location.findByPk(id);
    if (!location) {
      return res.status(404).json({ message: "Không tìm thấy vị trí." });
    }

    // 4️⃣ CHECK TRÙNG CODE (TRỪ CHÍNH NÓ)
    const existCode = await Location.findOne({
      where: {
        Code: trimmedCode,
        Id: { [Op.ne]: id },
      },
    });

    if (existCode) {
      return res.status(400).json({
        message: `Mã vị trí "${trimmedCode}" đã tồn tại.`,
      });
    }

    // 5️⃣ CHECK TRÙNG NAME (TRỪ CHÍNH NÓ)
    const existName = await Location.findOne({
      where: {
        Name: trimmedName,
        Id: { [Op.ne]: id },
      },
    });

    if (existName) {
      return res.status(400).json({
        message: `Tên vị trí "${trimmedName}" đã tồn tại.`,
      });
    }

    // 6️⃣ UPDATE
    await location.update({
      Code: trimmedCode,
      Name: trimmedName,
      Description: Description || null,
      IsActive: IsActive !== undefined ? IsActive : location.IsActive,
    });

    res.status(200).json({
      message: "Cập nhật vị trí thành công.",
      location,
    });
  } catch (err) {
    console.error("LỖI [LocationController:update]:", err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
};

// ======================================================================
// SOFT DELETE (SET IsActive = FALSE)
// ======================================================================
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const location = await Location.findByPk(id);
    if (!location) {
      return res.status(404).json({ message: "Không tìm thấy vị trí." });
    }

    // Nếu đã archive rồi thì không cần archive nữa
    if (location.Status === "archive") {
      return res.status(400).json({
        message: "Vị trí đã ở trạng thái archive.",
      });
    }

    await location.update({ Status: "archive" });

    return res.json({
      message: "Đã chuyển vị trí sang trạng thái archive.",
      location,
    });
  } catch (err) {
    console.error("LỖI [LocationController:remove]:", err);
    return res.status(500).json({ message: "Lỗi máy chủ." });
  }
};
exports.restore = async (req, res) => {
  try {
    const { id } = req.params;

    const location = await Location.findByPk(id);
    if (!location) {
      return res.status(404).json({ message: "Không tìm thấy vị trí." });
    }

    // Nếu đã active rồi thì không cần khôi phục
    if (location.Status === "active") {
      return res.status(400).json({
        message: "Vị trí đang ở trạng thái active.",
      });
    }

    await location.update({ Status: "active" });

    return res.json({
      message: "Khôi phục vị trí thành công.",
      location,
    });
  } catch (err) {
    console.error("LỖI [LocationController:restore]:", err);
    return res.status(500).json({ message: "Lỗi máy chủ." });
  }
};
