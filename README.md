# 📈 TradeWatch - Hệ Thống Giám Sát Chứng Khoán & Cảnh Báo Telegram

Hệ thống giám sát danh mục cổ phiếu Việt Nam (HOSE, HNX) thời gian thực, tự động thu thập biến động giá, lưu trữ chuỗi thời gian tối ưu, phân tích chỉ báo kỹ thuật phát hiện điểm nổ (Screener) và gửi cảnh báo Take-Profit / Stop-Loss qua Telegram chống spam.

---

## 🌟 Đặc Điểm Nổi Bật & Kiến Trúc

1. **Thu Thập Giá Không Headless Browser**:
   - Sử dụng `httpx` Asynchronous I/O gọi trực tiếp REST API từ các cổng tài chính (TCBS / SSI iBoard).
   - Tốc độ milli-giây, tiêu thụ RAM dưới 50MB, không bị nghẽn CPU hoặc dính WAF/Cloudflare như Selenium/Puppeteer.
2. **PostgreSQL 15+ Với Composite Index**:
   - Bảng `price_histories` được đánh chỉ mục hỗn hợp `(ticker, timestamp DESC)` để tối ưu hóa truy vấn lịch sử vẽ biểu đồ và lấy giá mới nhất với độ phức tạp $O(\log N)$.
3. **Dynamic Hot-Reload Scheduler**:
   - `APScheduler` quản lý tác vụ quét nền. Khi người dùng thay đổi chu kỳ quét từ giao diện, hệ thống tự động gọi `scheduler.reschedule_job` áp dụng ngay lập tức mà không cần restart server.
4. **Hệ Thống Cảnh Báo Telegram Chống Spam**:
   - Cơ chế Cooldown kiểm tra bảng `alert_logs`, chỉ gửi tin nhắn cảnh báo cùng loại cho 1 mã sau mỗi khoảng thời gian cấu hình (mặc định 15 phút).
   - Định dạng tin nhắn Markdown sắc nét, hiển thị: Mã CP, Giá hiện tại, Giá vốn, Lãi/Lỗ (%), Khuyến nghị hành động.
5. **Bộ Lọc Cổ Phiếu Tiềm Năng (Technical Screener)**:
   - Phát hiện đột biến khối lượng ($Volume \ge 1.5 \times SMA20$).
   - Phát hiện RSI(14) quá bán ($<35$) đảo chiều bật tăng từ đáy.
   - Phát hiện điểm phá vỡ đường trung bình động $MA20$.
6. **Frontend FinTech Dark Theme**:
   - React 18, TypeScript, Ant Design v5, TailwindCSS, Recharts.

---

## 🏗️ Cấu Trúc Dự Án

```
TradeWatch/
├── backend/
│   ├── app/
│   │   ├── config.py           # Pydantic Settings & Biến môi trường
│   │   ├── database.py         # SQLAlchemy 2.0 Async Session & Engine
│   │   ├── models.py           # Database Schema (Positions, PriceHistory, Settings, AlertLogs)
│   │   ├── schemas.py          # Pydantic v2 Request/Response Schemas
│   │   ├── crawler.py          # Async Stock Data Fetcher (TCBS/SSI)
│   │   ├── telegram_bot.py     # Telegram Alert Engine with Anti-Spam Cooldown
│   │   ├── scheduler.py        # APScheduler Dynamic Worker
│   │   ├── screener.py         # Technical Screener Engine
│   │   └── api/
│   │       ├── positions.py    # CRUD & PnL tracking
│   │       ├── history.py      # Lịch sử chuỗi thời gian
│   │       ├── settings.py     # Cấu hình hệ thống & Test Telegram
│   │       ├── screener.py     # Gợi ý mã tiềm năng
│   │       └── dashboard.py    # Thống kê KPI & Bot Toggle
│   ├── main.py                 # FastAPI Application Entrypoint
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HeaderStats.tsx        # KPI Counters & Bot Status
│   │   │   ├── PositionTable.tsx      # Bảng Danh mục Live PnL
│   │   │   ├── PositionModal.tsx      # Thêm/Sửa Vị thế & Xem trước TP/SL
│   │   │   ├── HistoryChartModal.tsx  # Biểu đồ giá Recharts với đường TP/SL
│   │   │   ├── SettingsDrawer.tsx     # Cài đặt Polling, Cooldown & Telegram
│   │   │   └── ScreenerModal.tsx      # Bảng Gợi ý Mã & Quick Add
│   │   ├── services/api.ts            # Axios Client
│   │   ├── types/index.ts             # TypeScript Type Definitions
│   │   ├── App.tsx                    # Layout chính & State Management
│   │   └── index.css                  # FinTech Dark Theme
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml          # Triển khai trọn gói Postgres, Backend, Frontend
└── README.md
```

---

## 🚀 Hướng Dẫn Chạy Nhanh Bằng Docker Compose (Khuyên Dùng)

Chỉ cần một câu lệnh duy nhất để khởi động toàn bộ cơ sở dữ liệu PostgreSQL, Backend API và Frontend:

```bash
docker compose up -d --build
```

- **Frontend Dashboard**: `http://localhost:3000`
- **FastAPI Swagger Docs**: `http://localhost:8000/docs`
- **PostgreSQL Database**: `localhost:5432` (User: `tradewatch`, Password: `tradewatch_secret`, DB: `tradewatch_db`)

---

## 💻 Hướng Dẫn Cài Đặt Môi Trường Phát Triển (Local Dev)

### 1. Khởi chạy Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Hoặc venv\Scripts\activate trên Windows
pip install -r requirements.txt

# Chạy server FastAPI
python main.py
```
Backend sẽ khởi chạy tại: `http://localhost:8000`

### 2. Khởi chạy Frontend

```bash
cd frontend
npm install
npm run dev
```
Frontend sẽ khởi chạy tại: `http://localhost:3000`

---

## ⚙️ Cấu Hình Telegram Bot Nhận Cảnh Báo

1. Mở ứng dụng Telegram, tìm `@BotFather` và gửi `/newbot` để tạo bot mới và lấy **Bot Token**.
2. Gửi bất kỳ tin nhắn nào tới bot của bạn, sau đó truy cập `https://api.telegram.org/bot<TOKEN>/getUpdates` hoặc chat với `@userinfobot` để lấy **Chat ID**.
3. Mở giao diện TradeWatch -> Nhấn nút **Cài đặt** -> Điền Bot Token & Chat ID -> Nhấn **Gửi Tin Nhắn Cảnh Báo Thử Nghiệm**.
