# AI Agent Workshop
> Công cụ: **Claude Code** | Ngày: 2026-02-xx | Speaker: Nguyễn Minh Nhựt

---

## Slide 1 - Title
```
AI Agent Workshop
2026-02-xx
```

---

## Slide 2 - Hook: Demo
```
[LIVE DEMO]

AI viết email xin nghỉ phép
  → đúng tone, đúng người nhận
  → gửi thật qua terminal

Không giải thích. Chỉ xem.
```

### Demo script:
```bash
claude "Viết email xin nghỉ phép ngày mai gửi cho sếp Tiến (tien@company.com).
Tone: lịch sự, ngắn gọn. Sau khi viết xong, gửi qua curl."
```
> **Speaker note:** Mở Claude Code, chạy lệnh, để mọi người xem AI viết + gửi email.
> Không giải thích gì. Tạo tò mò: "nó làm vậy bằng cách nào?"

---

## Slide 3 - Mục lục
```
Agenda

  Khái niệm              │  Thực hành
  ────────────────────────┼──────────────────────────────
  LLM = Chatbot           │  WS#1: Agent viết email
  + System Prompt         │       (cài Claude Code + prompt)
  + Memory / RAG          │  WS#2: Agent biết style của bạn
                          │       (auto-memory)
  + Tool Call             │  WS#3: Agent gửi Telegram
  Terminal = All You Need │       (skill + curl)
  Ghép hệ thống          │  WS#4: Agent tự check & reply email
                          │       (cookbook: workflow)

  Bonus: Cookbook coding   │  Vibe code game + AI bots đấu nhau
```
> **Speaker note:** Nhấn mạnh: mỗi workshop thêm 1 khả năng cho cùng 1 agent.
> Chatbot → biết style → gửi được → tự động hoá.

---

## Slide 4 - Tiến hoá LLM (phần 1)
```
Từ LLM đến Agent (1/2)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LLM cơ bản = Chatbot
  User: "viết email xin nghỉ phép"
  AI:   "Subject: Xin nghỉ phép..." (generic, không biết bạn là ai)

  → Chỉ biết trả text. Không biết context. Copy-paste tay.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LLM + System Prompt = Prompt Engineering Era
  System: "Bạn là trợ lý viết email cho Nhựt, team Mobile.
           Tone: lịch sự, ngắn gọn, kết thúc bằng 'Trân trọng'"
  User:   "viết email xin nghỉ phép"
  AI:     "Chào anh Tiến, Em Nhựt xin phép nghỉ... Trân trọng, Nhựt"

  → Đúng style, đúng tone. Nhưng vẫn copy-paste tay.
  → System Prompt = "tính cách" của AI
```
> **Speaker note:** Hai level đầu: LLM thô vs LLM có system prompt.
> Prompt engineering = dạy AI "bạn là ai, viết kiểu gì".
> Nhưng cả hai đều chỉ GHI text → user phải tự copy paste gửi.

---


## Slide 6 - WORKSHOP #1: Agent viết email
```
WORKSHOP #1
Agent viết email đúng style

Mục tiêu:
  ✓ Cài đặt Claude Code
  ✓ Hiểu System Prompt (CLAUDE.md)
  ✓ AI viết email theo phong cách của bạn

  Kết quả: chatbot viết email, chưa gửi được
```


### Workshop steps chi tiết:
```bash
# Bước 1: Cài Claude Code (nếu chưa)
npm install -g @anthropic-ai/claude-code
claude auth login

# Bước 2: Tạo project
mkdir email-agent && cd email-agent

# Bước 3: Mở Claude Code
claude
```
```
# Trong Claude Code:

# Bước 4: Tạo CLAUDE.md (= system prompt cho project)
> tạo file CLAUDE.md với nội dung:
> Bạn là trợ lý viết email cho tôi.
> Tên tôi: [tên người tham dự]
> Team: [team của họ]
> Phong cách viết:
> - Ngắn gọn, lịch sự
> - Dùng "Em" khi nói với sếp, "Mình" khi nói với đồng nghiệp
> - Luôn kết thúc bằng "Trân trọng" hoặc "Thanks"
> - Không dùng emoji trong email công việc

# Bước 5: Test
> viết email xin nghỉ phép ngày mai gửi cho sếp Tiến
> viết email hỏi đồng nghiệp Thiên Anh về deadline dự án

# Bước 6: Thử thay đổi style
> sửa CLAUDE.md: thêm "tone hài hước, gần gũi"
> viết lại email xin nghỉ phép

# So sánh 2 kết quả → thấy sức mạnh của system prompt
```
> **Speaker note:** ~15 phút. Ai cũng làm được. Key takeaway: CLAUDE.md = system prompt = "tính cách" AI.

## Slide 5 - Tiến hoá LLM (phần 2)
```
Từ LLM đến Agent (2/2)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LLM + System Prompt + Tools = Agent
  System: "Bạn là trợ lý email. Style: ...
           Bạn có thể GỬI email bằng curl.
           Bạn có thể ĐỌC danh bạ từ contacts.json"
  User:   "gửi email xin nghỉ phép cho sếp"
  AI:     → đọc contacts.json → tìm email sếp
          → viết email đúng style
          → curl gửi Gmail → Done ✓

  → Không chỉ VIẾT mà còn LÀM ĐƯỢC.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agentic AI = Tự chủ hoàn toàn
  System: "Mỗi 30 phút, check inbox.
           Nếu có email mới → phân tích → draft 2 reply options
           → gửi summary lên Telegram để user chọn"

  → AI không chờ lệnh. Tự check, tự làm, hỏi khi cần.
  → Đây là tương lai. Chúng ta sẽ build từng bước.
```
> **Speaker note:** Level 3 = có tools, LÀM được việc. Level 4 = tự chủ, có workflow.
> "Chúng ta sẽ build từng bước" → tạo kỳ vọng cho phần workshop.

---

---

## Slide 7 - Memory / RAG
```
Memory & RAG

Vấn đề: AI không biết thông tin riêng của bạn
  - Không biết sếp bạn tên gì
  - Không biết bạn đã nghỉ mấy ngày rồi
  - Không biết project đang làm gì

Giải pháp: cung cấp data cho AI

  Manual:    Paste thông tin vào prompt (mệt)
  RAG:       Hệ thống tự tìm data liên quan (phức tạp)
  Memory:    AI tự nhớ qua nhiều conversation (đơn giản ✓)

Claude Code hỗ trợ Memory sẵn:
  CLAUDE.md   → project-level memory (ai cũng thấy)
  MEMORY.md   → personal memory (chỉ bạn thấy)

  AI tự học từ bạn → càng dùng càng chính xác
```
> **Speaker note:** RAG phức tạp, nhưng Memory của Claude Code rất đơn giản.
> CLAUDE.md = team rules. MEMORY.md = cá nhân (email sếp, style riêng...).

---

## Slide 8 - WORKSHOP #2: Agent biết style và thông tin của bạn
```
WORKSHOP #2
Agent biết thông tin và style viết của bạn

Mục tiêu:
  ✓ Hiểu auto-memory (MEMORY.md)
  ✓ AI nhớ thông tin cá nhân qua nhiều session
  ✓ AI viết email match phong cách thật của bạn

  Kết quả: agent nhớ bạn là ai, viết đúng style
```

### Workshop steps chi tiết:
```
# Trong Claude Code (project email-agent):

# Bước 1: Tạo MEMORY.md với thông tin cá nhân
> tạo file .claude/MEMORY.md:
> - Sếp trực tiếp: Tiến (tien@company.com)
> - Đồng nghiệp: Thiên Anh (thien.anh@company.com)
> - Team: Mobile
> - Số ngày phép còn lại: 5
> - Project đang làm: App XYZ, deadline 15/03

# Bước 2: Thêm sample emails (để AI học style thật)
> tạo file sample-emails.md với 3-5 email bạn đã viết thật
> (copy paste từ email cũ)

# Bước 3: Cập nhật CLAUDE.md
> sửa CLAUDE.md: thêm dòng
> "Đọc sample-emails.md để học phong cách viết email của tôi"
> "Đọc .claude/MEMORY.md để biết thông tin contacts"

# Bước 4: Test - AI giờ biết context
> viết email xin nghỉ phép 2 ngày (thứ 5, thứ 6 tuần này)
# → AI biết gửi cho sếp Tiến, biết còn 5 ngày phép, viết đúng style

# Bước 5: Test auto-memory
> nhớ rằng tôi thích kết thúc email bằng "Best regards" thay vì "Trân trọng"
# → Claude tự lưu vào memory → lần sau tự dùng

# Bước 6: Mở session mới, test lại
# → AI vẫn nhớ preferences từ lần trước
```
> **Speaker note:** ~15 phút. Key takeaway: MEMORY.md + sample data = AI "biết" bạn.
> Auto-memory = AI tự nhớ preferences qua nhiều session.

---

## Slide 9 - Tool Calls & Terminal is All You Need
```
Tool Calls & Terminal

Vấn đề: Agent viết email rồi, nhưng chưa GỬI được.

Tool Call = cách AI gọi "function" bên ngoài

  User: "gửi email cho sếp"
  AI quyết định:
    1. Cần gọi tool không?  → Có
    2. Tool nào?            → send_email
    3. Tham số gì?          → {to: "tien@...", subject: "...", body: "..."}

Không cần tool phức tạp. Terminal đã đủ:

  curl     → gọi API, gửi email, gửi Telegram
  git      → quản lý code
  npm/mvn  → build, test

  AI + Terminal = AI làm được MỌI THỨ bạn làm trên máy tính

Skill = gói tool + prompt thành 1 file markdown (SKILL.md)
  → Non-dev cũng viết được
  → Custom cho từng project
```
> **Speaker note:** Cầu nối từ "viết" sang "làm". Tool call mechanism ngắn gọn.
> Terminal = tool vạn năng. Skill = cách đóng gói tool dễ nhất.

---

## Slide 10 - WORKSHOP #3: Agent gửi Telegram
```
WORKSHOP #3
Agent viết email + gửi tin nhắn Telegram

Mục tiêu:
  ✓ Hiểu tool call qua terminal (curl)
  ✓ Tạo Skill (SKILL.md) bằng skill-creator
  ✓ Agent gửi được Telegram message thật

  Kết quả: agent viết email + thông báo qua Telegram
```

### Workshop steps chi tiết:
```bash
# Bước 0: Chuẩn bị Telegram Bot
# (Speaker chuẩn bị trước 1 bot test, share token + chat_id cho mọi người)
# Hoặc mỗi người tạo bot qua @BotFather

# Bước 1: Cài skill-creator
mkdir -p .claude/skills/skill-creator
curl -o .claude/skills/skill-creator/SKILL.md \
  https://raw.githubusercontent.com/anthropics/skills/main/skills/skill-creator/SKILL.md
```
```
# Trong Claude Code:

# Bước 2: Test curl Telegram trước
> chạy lệnh curl gửi tin nhắn Telegram:
> curl -s -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
>   -d chat_id=<CHAT_ID> \
>   -d text="Hello from AI Agent!"

# Bước 3: Tạo skill email-agent bằng skill-creator
> /skill-creator tạo skill "email-agent":
> - Trigger: /email-agent [yêu cầu]
> - Đọc MEMORY.md để biết contacts và thông tin cá nhân
> - Đọc sample-emails.md để học style
> - Viết email theo yêu cầu, show preview
> - Sau khi user confirm:
>   + Lưu email ra file
>   + Gửi thông báo qua Telegram: "Đã draft email: [subject] → [to]"
>   + Template curl Telegram:
>     curl -s -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage"
>       -d chat_id=<CHAT_ID> -d text="..."

# Bước 4: Test
> /email-agent viết email xin nghỉ phép ngày mai

# → AI viết email → show preview → user confirm
# → Lưu file → gửi Telegram notification → Done

# Bước 5: Xem skill vừa tạo
> mở file .claude/skills/email-agent/SKILL.md
# → Thấy: chỉ là file markdown, chứa prompt + hướng dẫn dùng curl
```
> **Speaker note:** ~20 phút. Phần hay nhất: mọi người thấy agent LÀM ĐƯỢC VIỆC thật.
> Telegram notification = instant gratification. Key: Skill = markdown file.

---

## Slide 11 - Ghép hệ thống
```
Ghép hệ thống: Workflow

Đến giờ chúng ta có:
  ✓ AI viết email đúng style (system prompt)
  ✓ AI nhớ thông tin cá nhân (memory)
  ✓ AI gửi được Telegram (tool call / skill)

Còn thiếu gì?
  → AI chưa TỰ CHẠY. Vẫn cần bạn gõ lệnh.

Giải pháp: Workflow / Orchestration

  n8n           → kéo thả workflow, trigger theo lịch
  OpenClaw      → bot đa nền tảng (Telegram, Discord...)
  Claude Code   → agent trong terminal, có skill system
  Cron + Script → đơn giản nhất: cron job gọi AI

  ┌─────────┐     ┌──────────┐     ┌──────────┐
  │ Trigger │ ──→ │ AI Agent │ ──→ │ Action   │
  │ (cron)  │     │ (Claude) │     │ (curl)   │
  └─────────┘     └──────────┘     └──────────┘
```
> **Speaker note:** Slide lý thuyết nhẹ. Cầu nối sang WS#4 cookbook.

---

## Slide 12 - WORKSHOP #4 (Cookbook): Auto-reply Email Agent
```
WORKSHOP #4 (Cookbook - không thực hành, chỉ walkthrough)
Agent tự check email + đề xuất reply

Flow:
  ┌──────────────┐
  │ Cron (30min) │
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │ Fetch email  │ ← curl / IMAP
  │ lưu vào file │
  └──────┬───────┘
         ▼
  ┌──────────────┐
  │ Claude đọc   │ ← AI phân tích email mới
  │ + draft 2    │
  │   reply      │
  └──────┬───────┘
         ▼
  ┌──────────────────────────────┐
  │ Gửi Telegram 2 options:     │
  │  [A] "Dạ em confirm..."     │
  │  [B] "Em cần thêm thời..." │
  │                              │
  │ User bấm A hoặc B           │
  │ → AI gửi email đã chọn      │
  └──────────────────────────────┘
```

### Cookbook walkthrough:
```
# File structure:
email-agent/
  CLAUDE.md                  ← system prompt
  .claude/MEMORY.md          ← contacts, preferences
  .claude/skills/
    email-agent/SKILL.md     ← skill viết + gửi
    email-checker/SKILL.md   ← skill check inbox
  scripts/
    check-email.sh           ← cron job entry point
    fetch-inbox.sh           ← curl IMAP → inbox.json
  data/
    inbox.json               ← email mới fetch về
    drafts/                  ← AI draft replies ở đây

# check-email.sh (chạy mỗi 30 phút bởi cron):
  1. fetch-inbox.sh → lưu email mới vào inbox.json
  2. claude "/email-checker" → đọc inbox.json
     → draft 2 reply cho mỗi email
     → gửi Telegram với inline keyboard [Option A] [Option B]
  3. Khi user bấm nút trên Telegram
     → webhook trigger → claude gửi reply đã chọn

# Cron setup:
  */30 * * * * /path/to/check-email.sh
```
> **Speaker note:** KHÔNG thực hành. Chỉ walkthrough kiến trúc.
> Mục tiêu: mọi người thấy được bức tranh toàn cảnh - agent tự chủ hoàn toàn.
> "Bạn có thể build cái này sau workshop với những gì đã học."

---

## Slide 13 - Tổng kết
```
Tổng kết: Tiến hoá Email Agent

  WS#1: LLM + Prompt          → viết email (chatbot)
  WS#2: + Memory               → biết style, biết context
  WS#3: + Tool (terminal)      → gửi Telegram thật
  WS#4: + Workflow (cron)      → tự check & reply email

  ────────────────────────────────────────────

  Công thức chung:

    Agent = LLM + System Prompt + Memory + Tools
    Skill = đóng gói agent thành 1 file markdown
    Workflow = trigger + agent + action

  → Ai cũng có thể tạo AI Agent.
  → Bắt đầu từ system prompt, thêm dần khả năng.
```

---

## Slide 14 - Cookbook Bonus: Coding
```
Cookbook Bonus: Agent cho Developer

#1: Code → Test → Review → Repeat (tự động)
  /test-writer [file]   → AI viết unit test
  /test-runner           → chạy test, phân tích kết quả
  /code-reviewer [file]  → review code theo chuẩn
  → Lặp cho đến khi pass

#2: Vibe Code Game + AI Bots đấu nhau
  → Vibe code game caro HTML (CLAUDE.md + planning mode)
  → Tạo 2 AI bots chơi với nhau
  → 1 AI thứ 3 làm QC: monitor, check lỗi
  → 3 terminal chạy song song
```

### Cookbook #1 steps:
```
# Tạo 3 skill bằng skill-creator:
> /skill-creator tạo skill "test-writer":
>   Đọc code → viết unit test (jest/vitest/junit)
>   Cover happy path + edge cases

> /skill-creator tạo skill "test-runner":
>   Chạy npm test → dump output ra file → tóm tắt pass/fail

> /skill-creator tạo skill "code-reviewer":
>   Review: DRY, method < 30 lines, naming, hard-coded strings

# Flow tự động:
> viết code cho feature X
> /test-writer src/feature-x.js
> /test-runner
> fix lỗi nếu fail → /test-runner lại
> /code-reviewer src/feature-x.js
```

### Cookbook #2 steps:
```bash
# Vibe code game caro
mkdir caro-game && cd caro-game
claude
```
```
> tạo CLAUDE.md: game caro 15x15, HTML thuần, dark theme
> /plan tạo game caro
# approve → Claude code → mở browser test

# Tạo AI bots
> /skill-creator tạo skill "caro-player":
>   Đọc game-state.json → chọn nước đi → ghi lại

> /skill-creator tạo skill "game-monitor":
>   Check hợp lệ, đúng lượt, thắng/thua → ghi log
```
```bash
# 3 terminal:
claude "/caro-player X"    # Player X
claude "/caro-player O"    # Player O
claude "/game-monitor"     # QC
```
> **Speaker note:** Cookbook = tài liệu tham khảo. Ai muốn thử có thể làm sau workshop.

---

## Slide 15 - Q&A
```
Q & A

Tài liệu:
  Skill Creator:  github.com/anthropics/skills
  Claude Code:    claude.ai/claude-code
  Workshop repo:  [link repo này]

Cảm ơn mọi người!
```

---

# Mapping slide cũ → mới

| Slide | Nội dung | Nguồn |
|-------|----------|-------|
| 1 | Title | Slide1 (GIỮ) |
| 2 | Hook: demo email agent | MỚI |
| 3 | Mục lục | MỚI |
| 4 | Tiến hoá LLM (1/2): Chatbot → Prompt Engineering | Slide2+3 (GỘP+SỬA) |
| 5 | Tiến hoá LLM (2/2): Agent → Agentic AI | MỚI |
| 6 | WS#1: Agent viết email (cài Claude + prompt) | MỚI |
| 7 | Memory / RAG | MỚI |
| 8 | WS#2: Agent biết style (auto-memory) | MỚI |
| 9 | Tool Calls + Terminal is All You Need | Slide4+5+6 (GỘP+SỬA) |
| 10 | WS#3: Agent gửi Telegram (skill + curl) | MỚI |
| 11 | Ghép hệ thống: n8n, OpenClaw, Claude Code | MỚI |
| 12 | WS#4 Cookbook: Auto-reply email agent | MỚI |
| 13 | Tổng kết | MỚI |
| 14 | Cookbook Bonus: Coding (test/review + game bots) | MỚI |
| 15 | Q&A | MỚI |

# Thời gian ước tính

| Phần | Slides | Thời gian |
|------|--------|-----------|
| Hook + Tiến hoá LLM | 1-5 | ~15 phút |
| WS#1: Viết email (Claude + prompt) | 6 | ~15 phút |
| Memory/RAG | 7 | ~5 phút |
| WS#2: Biết style (auto-memory) | 8 | ~15 phút |
| Tool Calls | 9 | ~5 phút |
| WS#3: Gửi Telegram (skill + curl) | 10 | ~20 phút |
| Ghép hệ thống + WS#4 cookbook | 11-12 | ~10 phút |
| Tổng kết + Bonus + Q&A | 13-15 | ~10 phút |
| **Tổng** | | **~95 phút** |
