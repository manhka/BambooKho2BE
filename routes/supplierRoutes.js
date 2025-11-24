const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/suppliersController");
const auth = require("../middlewares/authMiddleware");

router.post("/", auth(["admin"]), supplierController.create);
router.put("/:id", auth(["admin"]), supplierController.update);
router.get("/", auth(), supplierController.list);
router.get("/:id", auth(), supplierController.get);

module.exports = router;
