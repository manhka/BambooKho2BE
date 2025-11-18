const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const auth = require("../middlewares/authMiddleware");

// Admin only
router.post("/", auth(["admin"]), categoryController.create);
router.put("/:id", auth(["admin"]), categoryController.update);
router.delete("/:id", auth(["admin"]), categoryController.archive);
router.post("/:id/restore", auth(["admin"]), categoryController.restore);

// All logged in users
router.get("/", auth(), categoryController.list);
router.get("/:id", auth(), categoryController.get);

module.exports = router;
