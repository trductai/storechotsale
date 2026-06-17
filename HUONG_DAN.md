# 🚀 HƯỚNG DẪN CÀI BOT NGỌC LINH STORE

## BƯỚC 1 — Tải code lên GitHub

1. Vào **github.com** → Đăng ký tài khoản (miễn phí)
2. Nhấn **New repository** → Đặt tên: `ngoclinh-bot`
3. Nhấn **uploading an existing file**
4. Kéo 2 file vào: `server.js` và `package.json`
5. Nhấn **Commit changes**

---

## BƯỚC 2 — Deploy lên Railway

1. Vào **railway.app** → Đăng nhập bằng GitHub
2. Nhấn **New Project** → **Deploy from GitHub repo**
3. Chọn repo `ngoclinh-bot`
4. Railway tự động deploy ✅

---

## BƯỚC 3 — Điền API Keys vào Railway

1. Vào project vừa tạo → tab **Variables**
2. Thêm 2 biến:
   - `CLAUDE_API_KEY` = key của bạn (sk-ant-...)
   - `PANCAKE_API_KEY` = key từ Pancake
3. Nhấn **Save** → Railway tự restart

---

## BƯỚC 4 — Lấy URL server

1. Vào tab **Settings** → **Domains**
2. Nhấn **Generate Domain**
3. Copy URL dạng: `https://ngoclinh-bot.up.railway.app`

---

## BƯỚC 5 — Cài Webhook vào Pancake

1. Đăng nhập **app.pancake.vn**
2. Vào **Cài đặt → Tích hợp → Webhook**
3. Dán URL: `https://ngoclinh-bot.up.railway.app/webhook`
4. Nhấn **Lưu**

---

## ✅ XONG! Bot sẽ tự động:
- Nhận tin nhắn từ khách trên Fanpage
- Tư vấn sản phẩm thời trang
- Hỏi thông tin và chốt đơn
- Trả lời 24/7 không nghỉ

---

## ❓ Nếu gặp lỗi
- Vào Railway → tab **Logs** để xem lỗi
- Kiểm tra lại API Keys đã điền đúng chưa
