# Workshop: AI Agent Skills & Workflows

## Agenda

1. **Kiến thức nền** — LLM, Agent, Workflow
2. **Demo Ideas** — Các ý tưởng demo thực tế
3. **Agent Skills** — Skill là gì, cách tạo skill mới
4. **Agent Workflow** — Heartbeat, cron, spawn — cách cấu hình
5. **Hands-on: Log Monitor Agent** — Build agent giám sát log, tự cảnh báo

---

## 1. Kiến thức nền

### 1.1 LLM cơ bản — Text In, Text Out

LLM (Large Language Model) nhận **text** và trả về **text**.

```
User: "Tóm tắt bài viết này..."
  ↓
LLM (GPT-3.5, GPT-4, Claude, ...)
  ↓
Bot: "Bài viết nói về..."
```

- Input/Output đều là text thuần
- Không thể tự gọi API, không truy cập internet, không thực thi code
- Ví dụ: ChatGPT trả lời câu hỏi, dịch văn bản, viết email

### 1.2 LLM + Tool = Agent

Agent = LLM có khả năng **gọi tool** (tool calling). LLM sinh ra lời gọi tool, hệ thống thực thi rồi trả kết quả lại.

Có **2 lớp** cần hiểu: LLM thật sự sinh gì, và API trả về gì cho developer.

#### Lớp 1: LLM thật sự sinh text — không hề biết JSON

Khi nhận được prompt (đã được API nhúng mô tả tool vào), LLM chỉ **sinh raw text**:

```
[Prompt mà API gửi vào LLM — dạng text thuần]

Bạn là trợ lý thông minh. Bạn có thể dùng các tool sau:
- get_weather(city: string): Lấy thời tiết theo thành phố

User: Thời tiết Hà Nội hôm nay?
```

```
[LLM sinh ra raw text — vẫn chỉ là text]

Tôi cần kiểm tra thời tiết.
<function_call>
{"name": "get_weather", "arguments": {"city": "Hanoi"}}
</function_call>
```

→ LLM **không biết** nó đang "gọi tool". Nó chỉ được huấn luyện để sinh text theo format `<function_call>` khi cần dùng tool.

#### Lớp 2: API đọc raw text → trả JSON cho developer

API layer (OpenAI, Anthropic, ...) **parse** raw text từ LLM và đóng gói thành JSON:

**Request (developer gửi):**

```json
{
  "messages": [
    {"role": "system", "content": "Bạn là trợ lý thông minh..."},
    {"role": "user",   "content": "Thời tiết Hà Nội hôm nay?"}
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Lấy thời tiết theo thành phố",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {"type": "string", "description": "Tên thành phố"}
          },
          "required": ["city"]
        }
      }
    }
  ]
}
```

**Response lần 1 (API trả về — đã parse từ raw text):**

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_abc123",
      "function": {
        "name": "get_weather",
        "arguments": "{\"city\": \"Hanoi\"}"
      }
    }
  ]
}
```

→ AI Provider đọc `tool_calls` → execute `get_weather("Hanoi")` → kết quả: `{"temp": 28, "condition": "mưa nhẹ"}`

**Request lần 2 (append tool result, gửi lại):**

```json
{
  "messages": [
    {"role": "system",    "content": "Bạn là trợ lý thông minh..."},
    {"role": "user",      "content": "Thời tiết Hà Nội hôm nay?"},
    {"role": "assistant", "content": null, "tool_calls": [
      {"id": "call_abc123", "function": {"name": "get_weather", "arguments": "{\"city\": \"Hanoi\"}"}}
    ]},
    {"role": "tool", "tool_call_id": "call_abc123",
     "content": "{\"temp\": 28, \"condition\": \"mưa nhẹ\"}"}
  ]
}
```

**Response lần 2 (LLM tổng hợp câu trả lời):**

```json
{
  "role": "assistant",
  "content": "Hà Nội hôm nay 28°C, có mưa nhẹ buổi chiều."
}
```

> **Key insight:** LLM chỉ biết **sinh text**. API layer mới là thằng:
> 1. Nhúng mô tả tool vào prompt (text) cho LLM
> 2. Parse raw text output thành JSON `tool_calls` cho developer
> 3. Chuyển `role: "tool"` result thành text cho LLM đọc ở lần gọi thứ 2

**Ví dụ tool phổ biến:**

| Tool | Mô tả | Ví dụ |
|------|--------|-------|
| Search | Tìm kiếm trên internet | Google Search, Bing |
| Deep Research | Nghiên cứu chuyên sâu, tổng hợp nhiều nguồn | Perplexity, Claude Research |
| Image Generation | Tạo ảnh từ mô tả | DALL-E, Midjourney |
| Chart Drawing | Vẽ biểu đồ từ dữ liệu | Mermaid, Chart.js |
| Code Execution | Chạy code và trả kết quả | Python sandbox, REPL |
| API Call | Gọi API bên ngoài | REST, GraphQL |

**Demo minh họa: Agent lấy thông tin game user**

```
User: "Xem thông tin player 'DragonSlayer99'"
  ↓
LLM → tool call: get_game_user_info("DragonSlayer99")
  ↓
Execute → query Game API → { level: 45, guild: "Phoenix", ... }
  ↓
LLM tổng hợp → "Player DragonSlayer99: Level 45, guild Phoenix..."
```

**Demo minh họa: Agent vibe-code một trang web HTML**

```
User: "Tạo web hiển thị thông tin player"
  ↓
LLM → sinh code HTML/CSS/JS hoàn chỉnh
  ↓
Hệ thống ghi file → mở browser preview
  ↓
User thấy trang web chạy ngay
```

### 1.3 Workflow — Kết hợp nhiều Agent

Workflow = chuỗi các agent/tool phối hợp để hoàn thành task phức tạp.

#### Agent viết code (Claude Code)

- Đọc codebase, hiểu context
- Sinh code mới, sửa bug, refactor
- Chạy test, commit, tạo PR

#### Copywriter workflow

```
Agent 1: Đọc bài tiếng Anh
  ↓
Agent 2: Dịch ra tiếng Việt
  ↓
Agent 3: Draft email từ nội dung đã dịch
  ↓
Output: Email tiếng Việt sẵn sàng gửi
```

#### AI-generated products (game, web, PPT...)

```
Agent Text     → Sinh nội dung, kịch bản, cấu trúc
  ↓
Agent Image    → Tạo ảnh, assets, illustrations
  ↓
Agent Assembly → Ghép nối text + ảnh → sản phẩm hoàn chỉnh
  ↓
Output: Game / Website / Slide deck
```

Ví dụ: Tạo game từ scratch, tạo landing page, tạo presentation.

#### Manual vs Automated Workflow

| | Manual Workflow | Automated Workflow |
|---|---|---|
| **Trigger** | Con người ra lệnh | Lịch (schedule) hoặc sự kiện server (event) |
| **Ví dụ** | "Dịch bài này", "Tạo game" | Mỗi 15 phút check log, khi có PR mới thì review |
| **Cài đặt** | Không cần | Config schedule/event trigger trên server |
| **Giám sát** | User theo dõi trực tiếp | Agent tự chạy, alert khi cần |

---

## 2. Demo Ideas

| # | Demo | Mô tả |
|---|------|-------|
| 1 | **Vibe Code** | Agent sinh code trực tiếp từ mô tả — tạo web, component, script |
| 2 | **Log Monitor & Alert** | Agent giám sát log server, phát hiện bất thường và gửi cảnh báo |
| 3 | **Task Manager (Telegram)** | Agent quản lý task qua Telegram — CRUD task list, nhắc deadline |
| 4 | **Content / Copywriter** | Agent đọc bài, dịch, viết lại, soạn email — workflow đa bước |
| 5 | **Game from Scratch** | Agent tạo game hoàn chỉnh từ mô tả: code + assets + playable |
| 6 | **Auto Test Writer** | Agent đọc code, viết test cases, chạy và báo kết quả |

---

## 3. Agent Skills

### Skill là gì?

Skill = một khả năng cụ thể mà agent biết cách dùng. Mỗi skill gồm:

| Thành phần | File | Vai trò |
|------------|------|---------|
| Định nghĩa | `SKILL.md` | Mô tả khi nào dùng, cách hoạt động, ví dụ |
| Script | `.sh` / `.bat` | Logic thực thi (gọi CLI, đọc file, API) |
| Data | `.json` | Dữ liệu lưu trữ (profile, log, config) |

### Cấu trúc thư mục

```
skills/
├── email-draft/          # Soạn email → mở Gmail/Outlook
│   ├── SKILL.md
│   ├── open-url.sh
│   └── open-url.bat
├── log-monitor/          # Giám sát log, cảnh báo lỗi
│   ├── SKILL.md
│   ├── check-log.sh
│   └── setup-agent.sh
└── zest/                 # Code review, sinh test
    ├── SKILL.md
    ├── code-review.md
    └── test-generation.md
```

### Cách tạo skill mới (3 bước)

**Bước 1:** Tạo thư mục `skills/<tên-skill>/`

**Bước 2:** Viết `SKILL.md` theo template:

```markdown
---
name: my-skill
description: Mô tả ngắn gọn skill làm gì
metadata: {"nanobot":{"emoji":"🎯"}}
---

# Tên Skill

## Khi nào sử dụng
- User nói "...", "..."

## Cách hoạt động
- Bước 1: ...
- Bước 2: ...

## Scripts
exec ./skills/my-skill/run.sh <args>

## Ví dụ trả lời
**User:** "..."
**Bot:** "..."
```

**Bước 3:** Viết script thực thi (nếu cần):

```bash
#!/bin/bash
# skills/my-skill/run.sh
set -euo pipefail
# Logic ở đây — gọi CLI, đọc file, curl API...
echo "Done"
```

### Skill được load như thế nào?

```
Agent khởi tạo
    ↓
discoverSkills() — quét skills/ tìm SKILL.md
    ↓
parseSkillMeta() — đọc front-matter (name, description, emoji)
    ↓
User chọn skills trong wizard
    ↓
buildAgentsMd() — nhúng NỘI DUNG SKILL.md vào AGENTS.md
    ↓
writePersonalAssistantSkills() — copy scripts sang workspace
    ↓
PicoClaw agent đọc AGENTS.md → biết cách dùng từng skill
```

### Nguyên tắc viết skill tốt

1. **Trigger rõ ràng** — liệt kê cụ thể user nói gì thì kích hoạt
2. **Script wrapper** — đừng bắt agent gõ lệnh dài, wrap vào `.sh`
3. **Ví dụ cụ thể** — cho agent thấy input/output mẫu
4. **Cross-platform** — có cả `.sh` (Linux/Mac) và `.bat` (Windows)
5. **Data persistent** — dùng JSON file trong workspace để nhớ state

---

## 4. Agent Workflow

PicoClaw agent có 3 cơ chế tự động hóa chính:

### 4.1 Heartbeat — Periodic Task Runner

Agent tự thức dậy định kỳ, đọc checklist, thực hiện tasks.

**Config (`~/.picoclaw/config.json`):**

```json
{
  "heartbeat": {
    "enabled": true,
    "interval": 30
  }
}
```

| Tham số | Mặc định | Mô tả |
|---------|----------|-------|
| `enabled` | `true` | Bật/tắt heartbeat |
| `interval` | `30` | Chu kỳ kiểm tra (phút), tối thiểu 5 |

**File task (`~/.picoclaw/workspace/HEARTBEAT.md`):**

```markdown
# Heartbeat Check List

## Instructions
- Thực hiện TẤT CẢ tasks bên dưới
- Task đơn giản → trả lời trực tiếp
- Task phức tạp → dùng spawn tạo subagent
- Chỉ trả lời HEARTBEAT_OK khi TẤT CẢ tasks xong

---

- Kiểm tra email quan trọng
- Tóm tắt tin tức AI mới nhất
- Check weather forecast
```

**Flow:**

```
Heartbeat trigger (mỗi 30 phút)
    ↓
Agent đọc HEARTBEAT.md
    ↓
Với mỗi task:
    ├── Task đơn giản → thực hiện ngay
    └── Task phức tạp → spawn subagent
    ↓
Tất cả xong → trả lời HEARTBEAT_OK
```

### 4.2 Cron — Scheduled Jobs

Job lên lịch chính xác, hỗ trợ interval và cron expression.

**Thêm job:**

```bash
# Mỗi 2 tiếng
picoclaw cron add --name "drink-water" --every 7200 --message "Uống nước!" --deliver

# Mỗi sáng 9h (cron expression)
picoclaw cron add --name "standup" --cron "0 9 * * 1-5" --message "Standup meeting!" --deliver
```

**Quản lý:**

```bash
picoclaw cron list          # Xem tất cả jobs
picoclaw cron remove <id>   # Xóa job
```

| Duration | Giây |
|----------|------|
| `30s` | 30 |
| `10m` | 600 |
| `2h` | 7200 |
| `1d` | 86400 |

### 4.3 Spawn — Async Subagent

Tạo agent con chạy song song, không block agent chính.

```
Agent chính                    Subagent
    │                              │
    ├── spawn("tìm tin AI")        │
    │                              ├── web_search(...)
    ├── tiếp tục task khác         ├── tổng hợp kết quả
    │                              ├── message("Tin AI hôm nay: ...")
    │                              └── done
    └── done
```

**Đặc điểm:**

| Feature | Mô tả |
|---------|-------|
| Non-blocking | Agent chính không chờ |
| Context độc lập | Subagent có context riêng |
| Có đầy đủ tools | message, web_search, exec, read/write file |
| Giao tiếp | Subagent dùng `message` tool gửi kết quả cho user |

### Kết hợp Heartbeat + Spawn + Cron

```
┌─────────────────────────────────────────────────┐
│                  PicoClaw Agent                  │
│                                                  │
│  HEARTBEAT (mỗi 30 phút)                        │
│    ├── Check log file → spawn(phân tích log)     │
│    ├── Check email → spawn(tóm tắt email)        │
│    └── Báo thời tiết → trả lời trực tiếp         │
│                                                  │
│  CRON JOBS                                       │
│    ├── 0 9 * * 1-5  "Standup reminder"           │
│    ├── every 2h     "Uống nước"                  │
│    └── 0 18 * * *   "Review tasks hôm nay"       │
│                                                  │
│  USER MESSAGES (bất kỳ lúc nào)                  │
│    ├── "Soạn email..."   → email-draft skill     │
│    ├── "Review code..."  → zest skill            │
│    └── "Check log..."   → log-monitor skill      │
└─────────────────────────────────────────────────┘
```

---

## 5. Hands-on: Log Monitor Agent

### Mục tiêu

Build một **agent hoàn chỉnh** (không chỉ skill) để tự động:
1. Đọc file log của ứng dụng định kỳ (heartbeat)
2. Tìm WARNING, ERROR, EXCEPTION (grep, pipe)
3. Gửi cảnh báo qua Telegram khi phát hiện vấn đề

### Khác biệt: Skill vs Agent

| | Skill | Agent |
|---|---|---|
| **Gồm** | SKILL.md + scripts | Skill + HEARTBEAT.md + AGENTS.md + config |
| **Kích hoạt** | User nhắn tin | Tự chạy định kỳ (heartbeat) |
| **Cần LLM** | Tùy | Không — template-based |

### Cách 1: Setup tự động (1 lệnh)

`setup-agent.sh` scaffold toàn bộ agent — không cần LLM generate:

```bash
# Đường dẫn file log
./skills/log-monitor/setup-agent.sh /var/log/myapp/app.log

# Đường dẫn folder (quét tất cả *.log)
./skills/log-monitor/setup-agent.sh /var/log/myapp/

# Custom interval (mặc định 15 phút)
./skills/log-monitor/setup-agent.sh /var/log/myapp/app.log 5

# Windows
skills\log-monitor\setup-agent.bat C:\logs\app.log
```

**Script tự động làm gì:**

```
setup-agent.sh /var/log/myapp/app.log
    │
    ├── Validate path tồn tại
    ├── Copy check-log.sh → workspace/skills/
    ├── Ghi HEARTBEAT.md (template, log path được điền sẵn)
    ├── Ghi AGENTS.md (persona monitor, không cần LLM)
    ├── Ghi IDENTITY.md, SOUL.md (template)
    ├── Cập nhật config.json → heartbeat.enabled = true
    └── Done — chạy `picoclaw gateway` để bắt đầu
```

### Cách 2: Setup thủ công (hiểu từng bước)

#### Bước 1: Cấu trúc skill `log-monitor`

```
skills/log-monitor/
├── SKILL.md           # Mô tả skill cho agent
├── check-log.sh       # Script chính (Linux/Mac)
├── check-log.bat      # Script chính (Windows)
├── setup-agent.sh     # Scaffold agent hoàn chỉnh
└── setup-agent.bat    # Scaffold agent (Windows)
```

#### Bước 2: Script `check-log.sh` — cốt lõi

Script dùng shell primitives (`tail`, `grep`, `wc`, `rm`, pipe `|`, `&&`):

```bash
# Đọc dòng mới kể từ lần check trước
tail -c +"$((LAST_OFFSET + 1))" "$LOG_FILE"

# Lọc errors (pipe + grep)
echo "$NEW_CONTENT" | grep -iE "(ERROR|EXCEPTION|FATAL)" || true

# Lọc warnings (pipe + grep, loại trừ errors)
echo "$NEW_CONTENT" | grep -i "WARN" | grep -ivE "(ERROR|EXCEPTION|FATAL)" || true

# Đếm (pipe + wc)
echo "$ERRORS" | wc -l | tr -d ' '

# Reset offset (rm)
rm -f "$OFFSET_FILE"
```

**Cơ chế offset tracking:**

```
Lần 1: app.log = 500 bytes
  → Đọc 500 bytes, lưu offset = 500

Lần 2: app.log = 800 bytes
  → Đọc từ byte 501-800 (chỉ dòng mới!)
  → Lưu offset = 800

Log rotation: app.log = 200 bytes (< 800)
  → File bị truncate → reset offset = 0
  → Đọc lại từ đầu
```

**Hỗ trợ folder mode:**

```bash
# Single file
./check-log.sh /var/log/app.log

# Folder — tự tìm tất cả *.log
./check-log.sh /var/log/myapp/
# → find ... -name '*.log' | while read f; do check_one_file "$f"; done
```

#### Bước 3: HEARTBEAT.md — agent tự chạy

File `~/.picoclaw/workspace/HEARTBEAT.md` (được `setup-agent.sh` ghi tự động):

```markdown
# Heartbeat Check List

Execute ALL tasks below. Use spawn for complex analysis.
Only respond HEARTBEAT_OK when all tasks are done AND nothing needs attention.

---

## Log Monitoring

1. Run: `exec ./skills/log-monitor/check-log.sh /var/log/myapp/app.log`
2. Parse the output:
   - If STATUS is NO_NEW_LINES → skip, no alert needed
   - If ERROR_COUNT > 0 → send message with error summary
   - If WARN_COUNT > 0 → send message with warning summary
   - If both are 0 but there are new lines → no alert needed
3. For large error counts (>10), use spawn to analyze patterns
```

#### Bước 4: AGENTS.md — persona agent (template, no LLM)

```markdown
# Agent: Log Monitor

You are a log monitoring agent. Your primary job is to watch
application log files and alert the user when errors or warnings appear.

## Behavior
- During heartbeat: run the log check script and analyze output
- When errors found: send a concise alert with the most important lines
- When warnings found: include them if count > 3, otherwise skip
- When log is clean: respond HEARTBEAT_OK silently
- Group similar errors together instead of listing duplicates
```

#### Bước 5: Config heartbeat

`~/.picoclaw/config.json` (cập nhật tự động bởi `setup-agent.sh`):

```json
{
  "heartbeat": {
    "enabled": true,
    "interval": 15
  }
}
```

### Test

```bash
# 1. Tạo file log giả
mkdir -p /tmp/test-logs
echo "[10:00:01] INFO  App started" > /tmp/test-logs/app.log
echo "[10:01:00] WARN  Memory usage: 82%" >> /tmp/test-logs/app.log
echo "[10:02:30] ERROR NullPointerException at OrderService.java:142" >> /tmp/test-logs/app.log

# 2. Test check-log.sh trực tiếp
./skills/log-monitor/check-log.sh /tmp/test-logs/app.log
# Output: FILE: ... STATUS: NEW_LINES LINES: 3 ERROR_COUNT: 1 WARN_COUNT: 1

# 3. Chạy lại → NO_NEW_LINES (đã đọc hết)
./skills/log-monitor/check-log.sh /tmp/test-logs/app.log
# Output: STATUS: NO_NEW_LINES

# 4. Thêm log mới → chỉ thấy dòng mới
echo "[10:05:00] ERROR Connection timeout" >> /tmp/test-logs/app.log
./skills/log-monitor/check-log.sh /tmp/test-logs/app.log
# Output: LINES: 1 ERROR_COUNT: 1

# 5. Reset offset → đọc lại từ đầu
./skills/log-monitor/check-log.sh --reset /tmp/test-logs/app.log
./skills/log-monitor/check-log.sh /tmp/test-logs/app.log

# 6. Setup agent hoàn chỉnh
./skills/log-monitor/setup-agent.sh /tmp/test-logs/app.log
# → Scaffold xong, chạy picoclaw gateway để bắt đầu monitor
```

### Flow hoàn chỉnh

```
picoclaw gateway
    ↓
Heartbeat trigger (mỗi 15 phút)
    ↓
Agent đọc HEARTBEAT.md
    ↓
exec ./skills/log-monitor/check-log.sh /var/log/myapp/app.log
    ↓
┌─ NEW_LINES              ┌─ NO_NEW_LINES
│  ERROR_COUNT: 3          │
│  WARN_COUNT: 5           └─ Agent: HEARTBEAT_OK
│
└─ Agent gửi Telegram:
   "⚠️ Log Alert — app.log
    🔴 Errors (3): ...
    🟡 Warnings (5): ..."
```

### So sánh: Template Agent vs LLM Agent

| | Template Agent (log-monitor) | LLM Agent (clawfather wizard) |
|---|---|---|
| **Setup** | `setup-agent.sh <path>` | Interactive wizard, AI generates |
| **AGENTS.md** | Template cố định | LLM tạo system prompt |
| **Khi nào dùng** | Task cụ thể, biết trước cần gì | Task mở, cần AI linh hoạt |
| **Shell primitives** | `grep`, `tail`, `wc`, `pipe` | Không cần |
| **Dependencies** | Chỉ bash | Node.js + LLM API |

### Mở rộng

| Ý tưởng | Cách làm |
|----------|----------|
| Nhiều folder log | `setup-agent.sh` nhiều lần hoặc sửa HEARTBEAT.md thêm dòng |
| Custom pattern | Sửa `ERROR_PATTERN` / `WARN_PATTERN` trong check-log.sh |
| Alert Slack | Thêm `curl -X POST webhook_url` trong HEARTBEAT.md |
| Auto-restart | HEARTBEAT.md: nếu error > 10 → `exec systemctl restart myapp` |
| Dashboard | Lưu count vào JSON mỗi lần check, vẽ trend |

---

## Tổng kết

| Concept | Mô tả |
|---------|-------|
| **LLM** | Text in → Text out, không có khả năng hành động |
| **Agent** | LLM + Tool calling — có thể tìm kiếm, tạo ảnh, chạy code |
| **Workflow** | Chuỗi agent phối hợp — copywriter, game builder, auto-test |
| **Automated Workflow** | Trigger theo lịch hoặc sự kiện, không cần con người ra lệnh |
| **Skill** | Dạy agent khả năng mới (SKILL.md + scripts) |
| **Heartbeat** | Chạy checklist định kỳ (HEARTBEAT.md) |
| **Cron** | Lên lịch chính xác (mỗi X giây, hoặc cron expression) |
| **Spawn** | Task nặng chạy song song, không block agent |

### Q&A

- **Skill có cần code Go/TypeScript không?** Không, chỉ cần Markdown + Shell scripts
- **Heartbeat và Cron khác gì?** Heartbeat = agent đọc checklist và tự quyết định. Cron = job cố định, gửi message đúng giờ
- **Spawn có giới hạn không?** Subagent có cùng tools, cùng security sandbox, nhưng context riêng
- **Hỗ trợ Windows không?** Có, viết thêm `.bat` song song với `.sh`
