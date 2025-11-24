const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const auth = require("../middlewares/authMiddleware");

// Admin only
router.post("/", auth(), categoryController.create);
router.put("/:id", auth(), categoryController.update);
router.delete("/:id", auth(), categoryController.archive);
router.post("/:id/restore", auth(), categoryController.restore);

// All logged in users
router.get("/", auth(), categoryController.list);
router.get("/:id", auth(), categoryController.get);

module.exports = router;
