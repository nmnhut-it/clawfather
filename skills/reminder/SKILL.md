---
name: reminder
description: Đặt nhắc nhở - một lần hoặc lặp lại định kỳ
metadata: {"nanobot":{"emoji":"⏰"}}
---

# Reminder - Nhắc Nhở

## Khi nào sử dụng

- User nói "nhắc tôi", "remind me", "đặt alarm"
- User nói "mỗi ngày nhắc...", "hàng tuần nhắc..."
- User hỏi "reminder nào đang có", "list reminders"

## Sử dụng PicoClaw Cron

PicoClaw có built-in cron tool. Dùng lệnh:

### Thêm reminder một lần
```bash
exec picoclaw cron add --once "10m" "Nhắc: Uống nước"
exec picoclaw cron add --once "2h" "Nhắc: Họp với team"
exec picoclaw cron add --once "2026-02-23T09:00" "Nhắc: Gửi báo cáo"
```

### Thêm reminder định kỳ
```bash
exec picoclaw cron add --every "1h" "Nhắc: Đứng dậy vận động"
exec picoclaw cron add --cron "0 9 * * 1-5" "Nhắc: Standup meeting"
exec picoclaw cron add --cron "0 8 * * *" "Nhắc: Check email buổi sáng"
```

### Xem danh sách reminders
```bash
exec picoclaw cron list
```

### Xóa reminder
```bash
exec picoclaw cron remove <job_id>
```

## Cron syntax phổ biến

| Pattern | Meaning |
|---------|---------|
| `0 9 * * *` | Mỗi ngày 9h sáng |
| `0 9 * * 1-5` | Thứ 2-6, 9h sáng |
| `0 */2 * * *` | Mỗi 2 tiếng |
| `30 8 * * 1` | Thứ 2 hàng tuần, 8h30 |
| `0 0 1 * *` | Ngày 1 mỗi tháng |

## Ví dụ trả lời

**User:** "Nhắc tôi gọi điện khách hàng sau 30 phút"
**Bot:**
```
⏰ Đã đặt reminder!
📋 Nội dung: Gọi điện khách hàng
🕐 Thời gian: 30 phút nữa (14:30)
```

**User:** "Mỗi sáng 8h nhắc tôi check Slack"
**Bot:**
```
⏰ Đã đặt reminder định kỳ!
📋 Nội dung: Check Slack
🔁 Lặp lại: Mỗi ngày 8:00 sáng
```

## Ngôn ngữ tự nhiên → Cron

| User nói | Chuyển thành |
|----------|--------------|
| "sau 10 phút" | `--once "10m"` |
| "sau 2 tiếng" | `--once "2h"` |
| "ngày mai 9h" | `--once "2026-02-23T09:00"` |
| "mỗi ngày 8h" | `--cron "0 8 * * *"` |
| "thứ 2 hàng tuần" | `--cron "0 9 * * 1"` |
| "mỗi 2 tiếng" | `--every "2h"` |
