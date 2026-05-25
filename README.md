# 🍳 Food Recommendation Project

Cấu trúc dự án mới:
- **ai-service/**: Python YOLOv8 & Speech Recognition API.
- **backend-api/**: Node.js Express Server kết nối Database.
- **mobile-app/**: React Native (Expo) Frontend.
- **scripts/**: Các công cụ tiện ích (rename script...).

Backend gợi ý tách lớp:
- **backend-api/src/services/**: service nghiệp vụ như gợi ý công thức, Cloudinary upload ảnh.
- **backend-api/src/errors/**: AppError, asyncHandler, errorHandler để gom logic bắt lỗi riêng.

Cloudinary env cho backend:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_BASE_FOLDER`

Thiết lập bảo mật env:
- Tạo file local: `backend-api/.env` (đã dùng cho DB/JWT/Cloudinary)
- Mẫu commit-safe: `backend-api/.env.example`
- `.env` đã được ignore bởi `.gitignore`, không đẩy key thật lên git
