---
name: log-monitor
description: Giám sát file log, phân tích semantic cảnh báo anomaly
metadata: {"nanobot":{"emoji":"📋"}}
---

# Log Monitor - Giám Sát Log

## Khi nào sử dụng

- Heartbeat tự động gọi định kỳ
- User nói "check log", "kiểm tra log", "có lỗi gì không"

## Cách hoạt động

1. Script đọc file log (tail last 50 lines)
2. Output raw content cho agent
3. Agent (LLM) phân tích semantic — không chỉ grep keyword

## Scripts

### Đọc log file
```bash
exec ./skills/log-monitor/check-log.sh <file-or-folder>
```

## Phân tích semantic

Khi nhận output từ check-log.sh, phân tích NỘI DUNG, không chỉ grep keyword:

- **Errors rõ ràng:** Exception, timeout, connection refused, OOM
- **Anomaly ẩn:** log bằng ngôn ngữ lạ, nội dung không phải app log, pattern bất thường
- **Performance:** slow query, high memory, high latency
- **Security:** unauthorized access, injection attempt, suspicious input

## Output format

⚠️ **Log Alert** — {file}

🔴 **Critical:** (mô tả vấn đề nghiêm trọng)
🟡 **Warning:** (mô tả cảnh báo)
🔵 **Anomaly:** (nội dung bất thường, không đúng format log)

📊 **Summary:** {lines} lines scanned

Khi log sạch:
✅ Log OK — không phát hiện vấn đề
