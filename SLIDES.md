# AI Agent Workshop — Từ LLM đến Agent

> Lý thuyết & Thực hành

---

## Agenda

| Phần | Nội dung |
|------|----------|
| **1** | LLM cơ bản & Chức năng |
| **2** | Tool Calling — cơ chế 2 lớp |
| **3** | Agent = LLM + Tools |
| **4** | Agent thực tế, MCP, Workflow |
| **5** | Setup: Ollama & Claude Code |
| **6** | Hands-on: Log Monitor Agent |

---

## 1. LLM cơ bản

**Large Language Model** — mô hình deep learning xử lý ngôn ngữ tự nhiên (hàng tỷ tham số).

**Bản chất:** dự đoán chuỗi từ (token) kế tiếp dựa vào input. Input/Output đều là **text thuần**.

```
User: "Tóm tắt bài viết này..." → LLM → Bot: "Bài viết nói về..."
```

**4 chức năng chính:**

| Chức năng | Mô tả |
|-----------|-------|
| **Completion** | Tạo/hoàn thành văn bản, chat format (assistant ↔ user) |
| **Tools** | Tương tác công cụ bên ngoài — model tự quyết định: dùng tool nào? tham số gì? |
| **Reasoning** | Tạo chuỗi lập luận (chain-of-thought) để cải thiện kết quả |
| **Vision** | Đọc input là hình ảnh |

**Vấn đề:** LLM không truy cập internet, không thực thi code → không trả lời được câu hỏi real-time.

```
User: "Thời tiết Hà Nội hôm nay?" → LLM: "Tôi không có khả năng truy cập thông tin thời gian thực..."
```

---

## 2. Tool Calling — Cơ chế 2 lớp

Thêm Tools vào → LLM trả lời dựa trên **Fact từ Tools**. LLM được gọi **2 lần** (lần 1: gọi tool, lần 2: tổng hợp reply).

Có **2 lớp** cần hiểu: LLM thật sự sinh gì vs API trả gì cho developer.

### Lớp 1: LLM chỉ sinh raw text

API nhúng mô tả tool vào prompt dạng text → LLM sinh text theo format được huấn luyện:

```
[Prompt — text thuần mà API gửi vào LLM]
Bạn là trợ lý thông minh. Bạn có thể dùng tool:
- get_weather(city: string): Lấy thời tiết theo thành phố

User: Thời tiết Hà Nội hôm nay?
```

```
[LLM sinh ra — vẫn chỉ là text]
Tôi cần kiểm tra thời tiết.
<function_call>
{"name": "get_weather", "arguments": {"city": "Hanoi"}}
</function_call>
```

→ LLM **không biết** nó đang "gọi tool" — nó chỉ được huấn luyện để sinh text theo format này.

### Lớp 2: API parse raw text → JSON cho developer

**Request (developer gửi):**

```json
{
  "messages": [
    {"role": "system", "content": "Bạn là trợ lý thông minh..."},
    {"role": "user",   "content": "Thời tiết Hà Nội hôm nay?"}
  ],
  "tools": [{"type": "function", "function": {
    "name": "get_weather",
    "parameters": {"properties": {"city": {"type": "string"}}, "required": ["city"]}
  }}]
}
```

**Response lần 1 (API đã parse raw text thành JSON):**

```json
{
  "role": "assistant", "content": null,
  "tool_calls": [{"id": "call_abc123", "function": {
    "name": "get_weather", "arguments": "{\"city\": \"Hanoi\"}"
  }}]
}
```

→ AI Provider execute `get_weather("Hanoi")` → `{"temp": 28, "condition": "mưa nhẹ"}`

**Request lần 2 (append tool result):**

```json
{
  "messages": [
    {"role": "system",    "content": "Bạn là trợ lý thông minh..."},
    {"role": "user",      "content": "Thời tiết Hà Nội hôm nay?"},
    {"role": "assistant", "content": null, "tool_calls": [...]},
    {"role": "tool", "tool_call_id": "call_abc123",
     "content": "{\"temp\": 28, \"condition\": \"mưa nhẹ\"}"}
  ]
}
```

**Response lần 2:** `"Hà Nội hôm nay 28°C, có mưa nhẹ buổi chiều."`

> **Key insight:** LLM chỉ biết **sinh text**. API layer mới là thằng:
> 1. Nhúng mô tả tool vào prompt (text) cho LLM
> 2. Parse raw text output → JSON `tool_calls` cho developer
> 3. Chuyển `role: "tool"` result → text cho LLM đọc ở lần 2

---

## 3. Agent = LLM + Tools

**AI Agent:** chương trình có thể thu thập dữ liệu, phân tích tình huống, tương tác với môi trường để xử lý yêu cầu người dùng.

**Công thức:** `Agent = LLM + Tool Calling`

**Điểm mạnh:**
- Đáp ứng tốt với điều kiện không rõ ràng — LLM tự suy luận khi nào cần tool
- Tự động trích xuất argument từ lịch sử chat
- Tool có thể là: trích xuất data, tính toán, hoặc một LLM khác

| Tool | Mô tả | Ví dụ |
|------|--------|-------|
| Search | Tìm kiếm trên internet | Google Search, Bing |
| Deep Research | Nghiên cứu chuyên sâu | Perplexity, Claude Research |
| Image Generation | Tạo ảnh từ mô tả | DALL-E, Midjourney |
| Code Execution | Chạy code và trả kết quả | Python sandbox, REPL |

**Demo: Agent vibe-code**

```
User: "Tạo web hiển thị thông tin player"
  ↓
LLM → sinh code HTML/CSS/JS hoàn chỉnh → ghi file → mở browser
  ↓
User thấy trang web chạy ngay
```

---

## 4. Agent thực tế, MCP & Workflow

### Cursor — AI Agent viết code

Agent = LLM + danh sách tools khai báo sẵn: `codebase_search`, `run_terminal_cmd`, `grep`, `edit_file`, `web_search`, `read_file`, `list_dir`, `create_diagram`...

### MCP — Model Context Protocol

Giao thức chuẩn hóa cung cấp tools giống API. Bất kỳ client nào (Cursor, Claude Desktop, ...) dùng được bất kỳ MCP server nào.

| MCP Server | Endpoints |
|------------|-----------|
| **mcp-time** | `/get_current_time`, `/convert_time` |
| **GPT Researcher** | `/deep_research`, `/quick_search`, `/write_report` |

### Workflow — Kết hợp nhiều Agent

Một sản phẩm phức tạp = nhiều agent + tool phối hợp. Giống như **công thức nấu ăn**: mỗi nguyên liệu (agent/tool) có vai trò riêng.

### Thách thức

- Không phải model nào cũng hỗ trợ tool calling (hoặc hỗ trợ ở level thấp)
- Khả năng gọi tools phụ thuộc vào độ thông minh của model
- Khai báo tools tốn context length → giới hạn số lượng tools

| | Manual Workflow | Automated Workflow |
|---|---|---|
| **Trigger** | Con người ra lệnh | Lịch hoặc sự kiện server |
| **Ví dụ** | "Dịch bài này" | Mỗi 15 phút check log |

---

## 5. Setup: Ollama & Claude Code

### Ollama — Chạy LLM local

Ollama cho phép chạy LLM trên máy tính cá nhân, không cần API key, không tốn tiền.

**Cài đặt:**

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows — tải installer từ https://ollama.com/download
```

**Chạy model:**

```bash
# Tải và chạy model (lần đầu sẽ download)
ollama pull qwen2.5:7b          # Model 7B — cân bằng tốc độ/chất lượng
ollama run qwen2.5:7b           # Chat trực tiếp trong terminal

# Các model khác
ollama pull llama3.1:8b          # Meta Llama 3.1
ollama pull deepseek-r1:8b       # DeepSeek R1 (reasoning mạnh)
ollama pull codellama:7b         # Chuyên code
```

**Kiểm tra:**

```bash
ollama list                      # Xem các model đã tải
ollama ps                        # Xem model đang chạy
curl http://localhost:11434/v1/models  # API endpoint (OpenAI-compatible)
```

Ollama expose API tại `http://localhost:11434` — tương thích format OpenAI API.

### Claude Code — AI Agent viết code

Claude Code là CLI agent của Anthropic — đọc codebase, sinh code, chạy test, commit.

**Cài đặt:**

```bash
# Cần Node.js >= 18
npm install -g @anthropic-ai/claude-code

# Chạy
claude
```

### Claude Code + Ollama (chạy local, miễn phí)

Dùng Ollama làm LLM backend cho Claude Code thông qua OpenAI-compatible API:

```bash
# 1. Chạy Ollama server (nếu chưa chạy)
ollama serve

# 2. Chạy Claude Code với Ollama backend
ANTHROPIC_BASE_URL=http://localhost:11434/v1 \
ANTHROPIC_MODEL=qwen2.5:7b \
claude
```

Hoặc cấu hình trong file `~/.claude/settings.json`:

```json
{
  "apiBaseUrl": "http://localhost:11434/v1",
  "model": "qwen2.5:7b"
}
```

**So sánh model cho tool calling:**

| Model | Size | Tool Calling | Ghi chú |
|-------|------|-------------|---------|
| `qwen2.5:7b` | 4.4 GB | Tốt | Khuyên dùng — hỗ trợ tool calling tốt |
| `llama3.1:8b` | 4.7 GB | Trung bình | Phổ biến, cộng đồng lớn |
| `deepseek-r1:8b` | 4.9 GB | Khá | Reasoning mạnh |
| `codellama:7b` | 3.8 GB | Yếu | Chuyên code nhưng tool calling yếu |

---

## 6. Công thức Agent — "Nấu" sản phẩm từ Agent + Tool

Mỗi sản phẩm = **công thức** pha trộn các agent và tool. Cùng nguyên liệu, khác cách kết hợp → khác sản phẩm.

### Nguyên liệu (Agent & Tool)

| Ký hiệu | Loại | Mô tả |
|----------|------|-------|
| `Agent Code` | Agent | Viết code (HTML/CSS/JS, Python, ...) |
| `Agent Test` | Agent | Viết test case, phân tích coverage |
| `Agent Review` | Agent | Review code, đề xuất fix |
| `Agent Content` | Agent | Viết nội dung, kịch bản, copy |
| `Agent Dịch` | Agent | Dịch ngôn ngữ (EN↔VN, ...) |
| `Agent Điều phối` | Agent | Lên kế hoạch, phân task, tổng hợp kết quả |
| `Agent Monitor` | Agent | Theo dõi, phân tích semantic, cảnh báo |
| `Tool Chạy code` | Tool | Execute code, trả kết quả/lỗi |
| `Tool Gen ảnh` | Tool | Tạo ảnh từ mô tả (DALL-E, Midjourney) |
| `Tool Gen âm thanh` | Tool | Tạo nhạc, SFX, voice (Suno, ElevenLabs) |
| `Tool Deploy` | Tool | Build & deploy lên server/hosting |
| `Tool Search` | Tool | Tìm kiếm web, tài liệu |
| `Tool Slide` | Tool | Tạo/chỉnh slide (PPTX, Google Slides API) |

---

### Công thức 1: Tạo Game từ scratch

```
User: "Tạo game Flappy Bird bằng HTML5"

Agent Điều phối
  ├── 1. Agent Content    → viết game design document (luật chơi, cấu trúc)
  ├── 2. Agent Code       → sinh code HTML5/Canvas/JS
  ├── 3. Tool Chạy code   → chạy thử, bắt lỗi runtime
  ├── 4. Agent Test       → viết test (collision, score, game over)
  ├── 5. Tool Chạy code   → chạy test, trả kết quả pass/fail
  ├── 6. Agent Review     → review code, đề xuất optimize
  ├── 7. Tool Gen ảnh     → gọi Midjourney tạo sprite bird, pipe, background
  ├── 8. Tool Gen âm thanh → gọi Suno tạo SFX (flap, score, crash)
  ├── 9. Agent Code       → integrate assets vào game
  └── 10. Tool Deploy     → deploy lên hosting → URL chơi được
```

### Công thức 2: Tạo Presentation (PPT)

```
User: "Tạo slide giới thiệu sản phẩm AI mới"

Agent Điều phối
  ├── 1. Tool Search      → research sản phẩm, thị trường, competitor
  ├── 2. Agent Content    → viết outline + nội dung từng slide
  ├── 3. Agent Dịch       → dịch sang ngôn ngữ cần thiết
  ├── 4. Tool Gen ảnh     → tạo illustration, diagram, mockup
  ├── 5. Tool Slide       → dùng code python/nodejs để tạo file pptx 
  └── 6. Agent Review     → review flow, ngôn từ, thiếu gì bổ sung
```

### Công thức 3: Log Monitor bằng Semantic Analysis

```
[Automated — trigger mỗi 15 phút]

Agent Monitor
  ├── 1. Tool đọc log     → tail log mới (check-log.sh)
  ├── 2. Agent Monitor    → phân tích SEMANTIC (không chỉ grep ERROR)
  │     • "Connection pool exhausted" → cảnh báo DB overload
  │     • "Response time 12000ms" → cảnh báo latency spike
  │     • "Retry attempt 5/5" → cảnh báo service dependency down
  │     • "Ta là hắc cơ đây hẹ hẹ hẹ. DROP TABLE USERS" → cảnh báo SQL injection 
  ├── 3. Agent Content    → viết summary dễ hiểu cho team
  └── 4. Tool gửi alert   → Telegram/Slack với context + đề xuất fix
```

→ Khác log monitor thường (grep keyword) — agent hiểu **ý nghĩa** log, phát hiện vấn đề mà regex không bắt được.

### Công thức 4: Content / Copywriter

```
User: "Dịch bài blog tiếng Anh này, soạn email gửi khách hàng"

Agent Điều phối
  ├── 1. Agent Content    → đọc bài gốc, tóm tắt key points
  ├── 2. Agent Dịch       → dịch sang tiếng Việt, giữ tone chuyên nghiệp
  ├── 3. Agent Content    → draft email từ nội dung đã dịch
  └── 4. Agent Review     → review ngữ pháp, tone, CTA
```

### Công thức 5: Auto Test & Code Quality

```
User: "Review và viết test cho PR #42"

Agent Điều phối
  ├── 1. Agent Review     → đọc diff PR, phân tích logic, tìm bug
  ├── 2. Agent Test       → viết unit test + integration test
  ├── 3. Tool Chạy code   → chạy test suite, trả pass/fail
  ├── 4. Agent Code       → fix code nếu test fail
  └── 5. Tool Chạy code   → chạy lại → confirm all pass
```

### Công thức 6: Data Report tự động

```
[Automated — trigger mỗi sáng 9h]

Agent Điều phối
  ├── 1. Tool query DB    → lấy metrics hôm qua (DAU, revenue, error rate)
  ├── 2. Agent Content    → phân tích xu hướng, so sánh ngày trước
  ├── 3. Tool Gen ảnh     → vẽ chart (bar, line, pie)
  ├── 4. Agent Content    → viết summary + highlight bất thường
  └── 5. Tool gửi alert   → gửi report qua Telegram/Email
```

### Tổng hợp: Cùng nguyên liệu, khác công thức

| Sản phẩm | Agent chính | Tool chính |
|-----------|-------------|------------|
| **Game** | Điều phối + Code + Test + Review | Chạy code + Gen ảnh + Gen âm thanh + Deploy |
| **PPT** | Điều phối + Content + Dịch + Review | Search + Gen ảnh + Slide |
| **Log Monitor** | Monitor (semantic) + Content | Đọc log + Gửi alert |
| **Copywriter** | Điều phối + Content + Dịch + Review | — |
| **Auto Test** | Điều phối + Review + Test + Code | Chạy code |
| **Data Report** | Điều phối + Content | Query DB + Gen ảnh + Gửi alert |

---

## 7. Skills & Automation

### Skill = khả năng cụ thể mà agent biết dùng

| Thành phần | File | Vai trò |
|------------|------|---------|
| Định nghĩa | `SKILL.md` | Mô tả khi nào dùng, cách hoạt động, ví dụ |
| Script | `.sh` / `.bat` | Logic thực thi |
| Data | `.json` | Dữ liệu lưu trữ |

**Tạo skill:** Tạo thư mục `skills/<tên>/` → Viết `SKILL.md` (trigger + cách hoạt động + ví dụ) → Viết script `.sh`

### Automation: Heartbeat, Cron, Spawn

| Cơ chế | Mô tả | Config |
|--------|-------|--------|
| **Heartbeat** | Agent tự thức dậy định kỳ, đọc checklist | `{ "heartbeat": { "interval": 30 } }` |
| **Cron** | Job lên lịch chính xác | `picoclaw cron add --cron "0 9 * * 1-5"` |
| **Spawn** | Tạo subagent chạy song song, không block | Agent gọi `spawn("task...")` |

```
┌──────────────────────────────────────────────────┐
│                  PicoClaw Agent                  │
│                                                  │
│  HEARTBEAT (mỗi 30 phút)                         │
│    ├── Check log → spawn(phân tích log)          │
│    └── Check email → spawn(tóm tắt)             │
│                                                  │
│  CRON: 0 9 * * 1-5 "Standup reminder"           │
│                                                  │
│  USER: "Soạn email..." → email-draft skill       │
└──────────────────────────────────────────────────┘
```

---

## 8. Hands-on: Log Monitor Agent — Setup

### Mục tiêu

Build agent tự động: đọc log định kỳ → tìm ERROR/WARNING → gửi cảnh báo Telegram.

| | Skill | Agent |
|---|---|---|
| **Gồm** | SKILL.md + scripts | Skill + HEARTBEAT.md + AGENTS.md + config |
| **Kích hoạt** | User nhắn tin | Tự chạy định kỳ (heartbeat) |

### Setup (1 lệnh)

```bash
./skills/log-monitor/setup-agent.sh /var/log/myapp/app.log
# → Scaffold: check-log.sh, HEARTBEAT.md, AGENTS.md, config → chạy picoclaw gateway
```

### check-log.sh — Script cốt lõi

```bash
tail -c +"$((LAST_OFFSET + 1))" "$LOG_FILE"                          # Đọc dòng mới
echo "$NEW_CONTENT" | grep -iE "(ERROR|EXCEPTION|FATAL)" || true     # Lọc errors
echo "$NEW_CONTENT" | grep -i "WARN" | grep -ivE "(ERROR|EXCEPTION|FATAL)" || true  # Lọc warnings
```

### HEARTBEAT.md + AGENTS.md

```markdown
## Log Monitoring
1. Run: `exec ./skills/log-monitor/check-log.sh /var/log/myapp/app.log`
2. STATUS = NO_NEW_LINES → skip | ERROR_COUNT > 0 → alert | WARN_COUNT > 0 → warning
```

```markdown
# Agent: Log Monitor
Watch log files, alert on errors/warnings. Log clean → HEARTBEAT_OK silently.
```

---

## 9. Hands-on: Log Monitor — Test & Chạy

```bash
# Tạo log giả
mkdir -p /tmp/test-logs
echo "[10:00:01] INFO  App started" > /tmp/test-logs/app.log
echo "[10:01:00] WARN  Memory usage: 82%" >> /tmp/test-logs/app.log
echo "[10:02:30] ERROR NullPointerException at OrderService.java:142" >> /tmp/test-logs/app.log

# Test → STATUS: NEW_LINES  ERROR_COUNT: 1  WARN_COUNT: 1
./skills/log-monitor/check-log.sh /tmp/test-logs/app.log

# Chạy lại → NO_NEW_LINES (đã đọc hết)
# Thêm log mới → chỉ thấy dòng mới
```

### Flow hoàn chỉnh

```
picoclaw gateway → Heartbeat (15 phút) → check-log.sh
    ↓
┌─ NEW_LINES + errors     ┌─ NO_NEW_LINES
│  → Telegram alert:       │  → HEARTBEAT_OK
│  "🔴 Errors (3): ..."    │
└──────────────────────    └──────────────
```

### Mở rộng

| Ý tưởng | Cách làm |
|----------|----------|
| Nhiều folder log | `setup-agent.sh` nhiều lần |
| Custom pattern | Sửa `ERROR_PATTERN` trong check-log.sh |
| Alert Slack | `curl -X POST webhook_url` trong HEARTBEAT.md |

---

## 10. Tổng kết

| Concept | Mô tả |
|---------|-------|
| **LLM** | Text in → Text out, dự đoán token kế tiếp |
| **Tool Calling** | LLM sinh text chứa lời gọi tool, API parse + execute |
| **Agent** | LLM + Tool Calling = hành động trên thế giới thực |
| **MCP** | Giao thức chuẩn hóa tool |
| **Workflow** | Chuỗi agent phối hợp, manual hoặc automated |
| **Ollama** | Chạy LLM local, miễn phí, OpenAI-compatible API |

### Q&A

### Tài liệu

| Tài liệu | Link |
|-----------|------|
| Ollama | https://ollama.com |
| Claude Code | https://docs.anthropic.com/en/docs/claude-code |
| OpenAI Agent SDK | https://github.com/openai/openai-agents-python |
| MCP Specification | https://modelcontextprotocol.io |
