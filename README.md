# MT5 Receiver Service

Service สำหรับรับข้อมูลจาก MT5 EA และส่งต่อไปยัง Backend Server

## Deploy on Render.com

### 1. สร้าง Web Service บน Render.com

1. ไปที่ [Render.com Dashboard](https://dashboard.render.com)
2. คลิก "New +" → "Web Service"
3. Connect repository หรือ Deploy from public Git repository

### 2. Configuration

**Build Command**: (ไม่ต้อง build)
```
(leave empty)
```

**Start Command**:
```
node server.js
```

**Environment Variables**:
```
BACKEND_SERVER_URL=https://your-backend-server.com
PORT=3001
```

### 3. Update MT5 EA

แก้ไข `ServerURL` ใน MT5 EA:
```
input string ServerURL = "https://your-receiver-service.onrender.com/api/mt5-data";
```

### 4. Health Check

Render.com จะใช้ endpoint `/health` สำหรับ health check

---

## Local Development

```bash
cd mt5-receiver
npm install
BACKEND_SERVER_URL=http://localhost:8080 node server.js
```

---

## Architecture

```
MT5 EA → HTTP POST → MT5 Receiver (Render.com) → Backend Server (Your Server)
```

