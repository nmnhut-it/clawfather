# 🦞 ClawFather — The Bot That Builds Bots

CLI wizard chạy trên terminal. Hỏi bạn mọi thứ, setup xong rồi chạy bot.

## Flow

```
$ node clawfather.js

  ██████╗██╗      █████╗ ██╗    ██╗
 ██╔════╝██║     ██╔══██╗██║    ██║
 ...
  F A T H E R  v1.0

[1/4] Telegram Bot Token
  ? Nhập token → validate với Telegram API → ✅

[2/4] LLM Backend
  ? Chọn: LM Studio / Ollama / LocalAI / OpenRouter / Custom
  → Tự detect endpoint → Lấy danh sách model → Test kết nối → ✅

[3/4] Thiết kế Bot
  ? Mô tả bot bạn muốn → AI tự build:
    • System prompt (200+ từ, production-ready)
    • Welcome message
    • Sample Q&A
    • Pipeline (temperature, max_tokens, context_window)
  → Preview → Chỉnh sửa (loop) → Lưu ✅

[4/4] Review & Launch
  → Tổng kết config → Lưu → 🚀 Chạy bot!
```

## Cài đặt

```bash
npm install
node clawfather.js
```

Chỉ vậy thôi. Không cần .env, không cần config trước.

## Chạy lại

```bash
node clawfather.js

# → Phát hiện config cũ → Menu:
#   1) 🚀 Chạy bot ngay
#   2) 🆕 Tạo bot mới
#   3) ⚙️ Setup lại
```

## Tính năng

- **Interactive CLI**: Hỏi từng bước, có preset, validate input
- **Auto-detect models**: Tự lấy danh sách model từ server
- **AI builds AI**: Mô tả → AI tạo prompt + pipeline
- **Refine loop**: Sửa đi sửa lại đến khi ưng
- **Persistent config**: Lưu vào `data/config.json`, restart không mất
- **Zero config**: Không cần .env hay file config trước
- **Tương thích**: LM Studio, Ollama, vLLM, LocalAI, OpenRouter, bất kỳ OpenAI-compatible API
