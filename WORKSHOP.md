# Workshop Guide - AI Agent với Claude Code
> Email Agent là ví dụ xuyên suốt, mỗi workshop thêm 1 khả năng

## Chuẩn bị trước workshop

```bash
# 1. Cài Node.js (>= 18)
node -v

# 2. Cài Claude Code
npm install -g @anthropic-ai/claude-code

# 3. Đăng nhập
claude auth login

# 4. Verify
claude --version

# 5. Speaker chuẩn bị Telegram Bot
#    → @BotFather → /newbot → lưu TOKEN + CHAT_ID
```

---

## Hook Demo (~3 phút)

Speaker demo trực tiếp. Người tham dự chỉ xem.

```bash
claude "Viết email xin nghỉ phép ngày mai gửi cho sếp Tiến (tien@company.com). \
Tone: lịch sự, ngắn gọn. Sau khi viết xong, gửi thông báo qua curl đến Telegram bot."
```

Không giải thích. Để tò mò.

---

## Slides 4-5: Tiến hoá LLM (~12 phút)

Trình chiếu, không thực hành. Key points:

1. **LLM = Chatbot**: chỉ trả text, generic, copy paste tay
2. **+ System Prompt**: đúng style, đúng tone (prompt engineering)
3. **+ Tools**: LÀM được việc thật (gửi email, gọi API)
4. **Agentic AI**: tự chạy, không cần chờ lệnh

Ví dụ xuyên suốt: email agent tiến hoá qua từng level.

---

## WS#1: Agent viết email (~15 phút)

### Mục tiêu
- Cài Claude Code
- Hiểu CLAUDE.md = system prompt

### Các bước

```bash
# Tạo project
mkdir email-agent && cd email-agent
claude
```

Trong Claude Code:
```
# Tạo CLAUDE.md
> tạo file CLAUDE.md với nội dung:
> Bạn là trợ lý viết email cho tôi.
> Tên tôi: [tên bạn]
> Team: [team của bạn]
> Phong cách viết:
> - Ngắn gọn, lịch sự
> - Dùng "Em" khi nói với sếp, "Mình" khi nói với đồng nghiệp
> - Luôn kết thúc bằng "Trân trọng"
> - Không dùng emoji trong email công việc

# Test
> viết email xin nghỉ phép ngày mai gửi cho sếp Tiến
> viết email hỏi đồng nghiệp Thiên Anh về deadline dự án

# Thử đổi style
> sửa CLAUDE.md: thêm "tone hài hước, gần gũi"
> viết lại email xin nghỉ phép
# → So sánh 2 kết quả
```

### Kiểm tra
- AI viết email đúng tone?
- Thay đổi CLAUDE.md → AI thay đổi style?

---

## Slide 7: Memory / RAG (~5 phút)

Trình chiếu. Key points:
- AI không biết thông tin riêng → cần cung cấp data
- CLAUDE.md = project memory (team rules)
- MEMORY.md = personal memory (contacts, preferences)
- Auto-memory = AI tự nhớ qua nhiều session

---

## WS#2: Agent biết style của bạn (~15 phút)

### Mục tiêu
- Dùng MEMORY.md cho thông tin cá nhân
- AI viết email match style thật

### Các bước

```
# Trong Claude Code (project email-agent):

# Tạo MEMORY.md
> tạo file .claude/MEMORY.md:
> Sếp trực tiếp: Tiến (tien@company.com)
> Đồng nghiệp: Thiên Anh (thien.anh@company.com)
> Team: Mobile
> Ngày phép còn: 5
> Project: App XYZ, deadline 15/03

# Thêm sample emails
> tạo file sample-emails.md
> (paste 3-5 email thật bạn đã viết)

# Cập nhật CLAUDE.md
> sửa CLAUDE.md: thêm
> "Đọc sample-emails.md để học phong cách viết email của tôi"
> "Đọc .claude/MEMORY.md để biết thông tin contacts"

# Test
> viết email xin nghỉ phép 2 ngày (thứ 5-6 tuần này)
# → AI biết gửi cho sếp Tiến, biết còn 5 ngày phép

# Test auto-memory
> nhớ rằng tôi thích kết thúc email bằng "Best regards"
# → Claude tự lưu → lần sau tự dùng
```

### Kiểm tra
- AI biết tên sếp, email sếp?
- AI dùng đúng style từ sample emails?
- Mở session mới → AI vẫn nhớ?

---

## Slide 9: Tool Calls & Terminal (~5 phút)

Trình chiếu. Key points:
- Tool call = AI gọi function bên ngoài
- Terminal = tool mạnh nhất (curl, git, npm...)
- Skill = gói tool + prompt thành SKILL.md

---

## WS#3: Agent gửi Telegram (~20 phút)

### Mục tiêu
- Hiểu tool call qua terminal (curl)
- Tạo Skill bằng skill-creator
- Agent gửi được Telegram message thật

### Chuẩn bị
```
# Telegram Bot info (speaker share):
BOT_TOKEN=<token>
CHAT_ID=<chat_id>
```

### Các bước

```bash
# Cài skill-creator
mkdir -p .claude/skills/skill-creator
curl -o .claude/skills/skill-creator/SKILL.md \
  https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md
```

```
# Trong Claude Code:

# Test curl Telegram trước
> chạy: curl -s -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
>   -d chat_id=<CHAT_ID> -d text="Hello from AI Agent!"
# → Kiểm tra Telegram, phải nhận được tin nhắn

# Tạo skill email-agent
> /skill-creator tạo skill "email-agent":
> - Trigger: /email-agent [yêu cầu]
> - Đọc MEMORY.md để biết contacts
> - Đọc sample-emails.md để học style
> - Viết email, show preview cho user
> - Sau khi user confirm:
>   + Lưu email ra file drafts/
>   + Gửi Telegram thông báo: "Đã draft email: [subject] → [to]"
>   + Dùng curl gọi Telegram Bot API

# Test
> /email-agent viết email xin nghỉ phép ngày mai
# → AI viết → preview → confirm → lưu file + Telegram notification
```

### Kiểm tra
- Telegram nhận được notification?
- File email được lưu trong drafts/?
- Mở .claude/skills/email-agent/SKILL.md → chỉ là markdown?

---

## Slides 11-12: Ghép hệ thống + Cookbook WS#4 (~10 phút)

Trình chiếu + walkthrough. Không thực hành.

Giải thích kiến trúc auto-reply agent:
1. Cron job mỗi 30 phút
2. Fetch email mới → lưu file
3. Claude đọc + draft 2 reply options
4. Gửi Telegram với 2 nút chọn
5. User bấm → AI gửi reply đã chọn

Message: "Bạn có thể build cái này sau workshop."

---

## Cookbook Bonus: Coding

### #1: Code → Test → Review
```
# Tạo 3 skill:
> /skill-creator tạo skill "test-writer"
> /skill-creator tạo skill "test-runner"
> /skill-creator tạo skill "code-reviewer"

# Flow:
> viết code feature X
> /test-writer src/feature-x.js
> /test-runner
> fix nếu fail → test lại
> /code-reviewer src/feature-x.js
```

### #2: Vibe Code Game + AI Bots
```bash
mkdir caro-game && cd caro-game
claude
```
```
> tạo CLAUDE.md: game caro 15x15, HTML thuần, dark theme
> /plan tạo game caro
# approve → code → test

> /skill-creator tạo skill "caro-player"
> /skill-creator tạo skill "game-monitor"
```
```bash
# 3 terminal song song:
claude "/caro-player X"
claude "/caro-player O"
claude "/game-monitor"
```

---

## Checklist trước workshop

- [ ] Tất cả máy cài Node.js >= 18
- [ ] Tất cả máy cài Claude Code
- [ ] Tất cả máy đăng nhập Claude
- [ ] Telegram Bot tạo sẵn (TOKEN + CHAT_ID)
- [ ] Wifi ổn định
- [ ] Speaker test thử tất cả demo 1 lần

## Troubleshooting

| Lỗi | Fix |
|-----|-----|
| `claude: command not found` | `npm install -g @anthropic-ai/claude-code` |
| Auth failed | `claude auth login` lại |
| Skill không nhận | Check path `.claude/skills/[name]/SKILL.md` |
| Telegram curl fail | Check TOKEN + CHAT_ID, thử curl thủ công |
| Rate limit | Chờ 1 phút, thử lại |
