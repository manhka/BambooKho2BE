const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Thư mục lưu file tạm
const uploadDir = path.join(__dirname, "../uploads");

// Kiểm tra thư mục, nếu chưa có thì tạo
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("Đã tạo thư mục uploads/");
}

// Cấu hình multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

module.exports = upload;
