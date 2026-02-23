#!/usr/bin/env bash
# ============================================================
#  ClawFather — PicoClaw Bootstrap Script
# ============================================================
#  Usage: ./clawfather.sh
#  Deps:  bash, curl (jq auto-installed if missing)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
CONFIG_FILE="$DATA_DIR/config.json"
BIN_DIR="$DATA_DIR/bin"
export PATH="$BIN_DIR:$PATH"
SKILLS_DIR="$SCRIPT_DIR/skills"
PICO_DIR="$HOME/.picoclaw"
WORKSPACE="$PICO_DIR/workspace"
PICO_CONFIG="$PICO_DIR/config.json"
RELEASES_URL="https://api.github.com/repos/sipeed/picoclaw/releases/latest"
MAX_MODELS=20
DEFAULT_CONTEXT_WINDOW=131072
DEFAULT_WEB_MAX_RESULTS=5
DEFAULT_CRON_TIMEOUT_MINUTES=5

# ── LLM Proxy (Qwen tool-call conversion) ────────────────
PROXY_PORT=13580
PROXY_HOST="127.0.0.1"
PROXY_URL="http://${PROXY_HOST}:${PROXY_PORT}/v1"
PROXY_SCRIPT="$SCRIPT_DIR/llm-proxy.js"
PROXY_PID=""
ZINGPLAY_PATTERN="zingplay"
ENV_FILE="$SCRIPT_DIR/.env"

# ── Load .env defaults ──────────────────────────────────────
# Exports LLM_BASE_URL, LLM_API_KEY, etc. for use as wizard defaults.
[[ -f "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a

# ── Colors ──────────────────────────────────────────────────
R='\033[0m' B='\033[1m' D='\033[2m'
RED='\033[31m' GRN='\033[32m' YEL='\033[33m'
BLU='\033[34m' MAG='\033[35m' CYN='\033[36m'

info()  { echo -e "${CYN}ℹ${R} $1" >&2; }
ok()    { echo -e "${GRN}✅${R} $1" >&2; }
err()   { echo -e "${RED}❌${R} $1" >&2; }
warn()  { echo -e "${YEL}⚠${R}  $1" >&2; }
dim()   { echo -e "${D}  $1${R}" >&2; }
step()  { echo -e "\n${B}${BLU}[$1/$2]${R} ${B}$3${R}" >&2; }

banner() {
  echo -e "${B}${MAG}"
  echo "   ██████╗██╗      █████╗ ██╗    ██╗"
  echo "  ██╔════╝██║     ██╔══██╗██║    ██║"
  echo "  ██║     ██║     ███████║██║ █╗ ██║"
  echo "  ██║     ██║     ██╔══██║██║███╗██║"
  echo "  ╚██████╗███████╗██║  ██║╚███╔███╔╝"
  echo "   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝"
  echo -e "  ${CYN}F A T H E R${R}  ${D}v2.0 — Shell Bootstrap${R}"
  echo
}

# ── UI helpers ──────────────────────────────────────────────
ask() {
  local prompt="$1" default="${2:-}" hint=""
  [[ -n "$default" ]] && hint=" ${D}($default)${R}"
  echo -en "  ${YEL}?${R} ${prompt}${hint}: " >&2
  read -r ans
  echo "${ans:-$default}"
}

confirm() {
  local prompt="$1" default="${2:-y}"
  local hint="[Y/n]"; [[ "$default" == "n" ]] && hint="[y/N]"
  local a; a=$(ask "$prompt $hint")
  a="${a:-$default}"
  [[ "$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')" == y* ]]
}

choose() {
  local prompt="$1"; shift
  local opts=("$@")
  echo -e "\n  ${YEL}?${R} $prompt" >&2
  for i in "${!opts[@]}"; do
    echo -e "    ${CYN}$((i+1)))${R} ${opts[$i]}" >&2
  done
  while true; do
    local n; n=$(ask "Chọn (1-${#opts[@]})")
    if [[ "$n" =~ ^[0-9]+$ ]] && (( n >= 1 && n <= ${#opts[@]} )); then
      echo "$((n-1))"; return
    fi
    warn "Số không hợp lệ." >&2
  done
}

# ── JSON helpers ───────────────────────────────────────────
# Read a value from JSON. Returns non-zero if missing/null.
json_val() {
  local result
  result=$(jq -r "$2" <<< "$1" 2>/dev/null) || return 1
  [[ "$result" != "null" ]] || return 1
  echo "$result"
}

# Extract first JSON object from text (strips markdown fences)
json_extract() {
  sed '/^```[a-z]*/d' | jq '.' 2>/dev/null
}

# ── Platform detection ──────────────────────────────────────
detect_platform() {
  local os arch
  case "$(uname -s)" in
    Darwin*)  os="Darwin" ;;
    Linux*)   os="Linux" ;;
    MINGW*|MSYS*|CYGWIN*) os="Windows" ;;
    *) err "OS không được hỗ trợ: $(uname -s)"; exit 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch="x86_64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) err "Arch không được hỗ trợ: $(uname -m)"; exit 1 ;;
  esac
  echo "${os}_${arch}"
}

picoclaw_exe() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) echo "picoclaw.exe" ;;
    *) echo "picoclaw" ;;
  esac
}

# ── jq binary ──────────────────────────────────────────────
JQ_RELEASES_URL="https://github.com/jqlang/jq/releases/latest/download"

install_jq() {
  mkdir -p "$BIN_DIR"
  local os arch suffix=""
  case "$(uname -s)" in
    Darwin*)  os="macos" ;;
    Linux*)   os="linux" ;;
    MINGW*|MSYS*|CYGWIN*) os="windows"; suffix=".exe" ;;
    *) err "OS không được hỗ trợ"; return 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch="amd64" ;;
    aarch64|arm64) arch="arm64" ;;
    *) err "Arch không được hỗ trợ"; return 1 ;;
  esac

  local filename="jq-${os}-${arch}${suffix}"
  local url="${JQ_RELEASES_URL}/${filename}"
  local dest="$BIN_DIR/jq${suffix}"

  info "Tải jq..."
  curl -fsSL -o "$dest" "$url" || { err "Không tải được jq"; return 1; }
  chmod +x "$dest" 2>/dev/null || true
  ok "jq: $dest"
}

ensure_jq() {
  command -v jq &>/dev/null && return 0
  warn "jq chưa cài."
  install_jq
}

# ── PicoClaw binary ─────────────────────────────────────────
find_picoclaw() {
  local exe; exe=$(picoclaw_exe)
  local managed="$BIN_DIR/$exe"
  [[ -f "$managed" ]] && { echo "$managed"; return; }
  command -v "$exe" 2>/dev/null && return
  return 1
}

install_picoclaw() {
  mkdir -p "$BIN_DIR"
  local platform; platform=$(detect_platform)
  local ext="tar.gz"; [[ "$platform" == Windows_* ]] && ext="zip"
  local asset="picoclaw_${platform}.${ext}"

  info "Tìm phiên bản mới nhất..."
  local release; release=$(curl -fsSL -H "User-Agent: ClawFather/2.0" "$RELEASES_URL")
  local url; url=$(jq -r --arg name "$asset" \
    '.assets[] | select(.name == $name) | .browser_download_url' <<< "$release" 2>/dev/null)

  if [[ -z "$url" || "$url" == "null" ]]; then
    err "Asset '$asset' không tìm thấy"; return 1
  fi

  local tag; tag=$(json_val "$release" '.tag_name' || echo "unknown")
  ok "PicoClaw $tag"

  info "Tải $asset..."
  local archive="$BIN_DIR/$asset"
  curl -fsSL -o "$archive" "$url"
  ok "Tải xong"

  info "Giải nén..."
  if [[ "$ext" == "zip" ]]; then
    unzip -o "$archive" -d "$BIN_DIR"
  else
    tar -xzf "$archive" -C "$BIN_DIR"
  fi
  rm -f "$archive"

  local exe; exe=$(picoclaw_exe)
  chmod +x "$BIN_DIR/$exe" 2>/dev/null || true
  [[ -f "$BIN_DIR/$exe" ]] || { err "Binary không tìm thấy"; return 1; }
  ok "Đã cài: $BIN_DIR/$exe"
}

ensure_picoclaw() {
  info "Kiểm tra PicoClaw..."
  local pc
  if pc=$(find_picoclaw); then
    ok "PicoClaw: $pc"
    echo "$pc"
  else
    warn "PicoClaw chưa cài."
    confirm "Cài đặt PicoClaw?" || { err "Cần PicoClaw để tiếp tục."; exit 1; }
    install_picoclaw
    echo "$BIN_DIR/$(picoclaw_exe)"
  fi
}

# ── LLM Proxy ──────────────────────────────────────────────
is_zingplay_url() {
  [[ "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" == *"$ZINGPLAY_PATTERN"* ]]
}

ensure_proxy_deps() {
  command -v node &>/dev/null || {
    err "Cần Node.js để chạy LLM Proxy."; return 1
  }
  [[ -f "$PROXY_SCRIPT" ]] || {
    err "Không tìm thấy llm-proxy.js"; return 1
  }
  if [[ ! -d "$SCRIPT_DIR/node_modules/htmlparser2" ]]; then
    info "Cài đặt dependencies cho LLM Proxy..."
    (cd "$SCRIPT_DIR" && npm install --production 2>&1) >&2 || {
      err "npm install thất bại"; return 1
    }
    ok "Dependencies OK"
  fi
}

start_llm_proxy() {
  local target_url="$1" target_key="$2"
  ensure_proxy_deps || return 1

  info "Khởi động LLM Proxy (port $PROXY_PORT)..."
  LLM_BASE_URL="$target_url" LLM_API_KEY="$target_key" \
    LLM_PROXY_PORT="$PROXY_PORT" LLM_PROXY_HOST="$PROXY_HOST" \
    node "$PROXY_SCRIPT" &
  PROXY_PID=$!

  sleep 2
  if kill -0 "$PROXY_PID" 2>/dev/null; then
    ok "LLM Proxy: PID $PROXY_PID → ${target_url}"
    return 0
  fi
  err "LLM Proxy không khởi động được."
  PROXY_PID=""
  return 1
}

stop_llm_proxy() {
  if [[ -n "${PROXY_PID:-}" ]] && kill -0 "$PROXY_PID" 2>/dev/null; then
    dim "Dừng LLM Proxy (PID $PROXY_PID)..."
    kill "$PROXY_PID" 2>/dev/null || true
    wait "$PROXY_PID" 2>/dev/null || true
    PROXY_PID=""
  fi
}

# ── Load existing config ────────────────────────────────────
load_config() {
  [[ -f "$CONFIG_FILE" ]] && cat "$CONFIG_FILE" || echo "{}"
}

# ── Setup: Telegram ─────────────────────────────────────────
setup_telegram() {
  step 1 4 "Telegram Bot Token"
  echo >&2
  dim "Tạo: @BotFather → /newbot → copy token (dạng 123456:ABC...)"
  echo >&2

  local existing="$1"
  if [[ -n "$existing" && "$existing" != "null" ]]; then
    local masked="${existing:0:8}••••${existing: -4}"
    info "Token hiện tại: $masked"
    if confirm "Giữ token cũ?"; then echo "$existing"; return; fi
  fi

  while true; do
    local token; token=$(ask "Telegram Bot Token")
    [[ "$token" == *":"* ]] || { warn "Token phải chứa ':'"; continue; }

    info "Kiểm tra token..."
    local resp; resp=$(curl -fsSL "https://api.telegram.org/bot${token}/getMe" 2>/dev/null || echo '{}')
    local is_ok; is_ok=$(json_val "$resp" '.ok' 2>/dev/null || echo "false")
    if [[ "$is_ok" == "true" ]]; then
      local username; username=$(json_val "$resp" '.result.username' || echo "")
      ok "Bot: @$username"
      echo "$token"; return
    fi
    err "Token không hợp lệ."
  done
}

# ── Setup: LLM ──────────────────────────────────────────────
setup_llm() {
  step 2 4 "OpenAI-Compatible LLM"
  echo >&2
  dim "Hỗ trợ: LM Studio, Ollama, vLLM, OpenRouter, NVIDIA NIM..."
  echo >&2

  local existing_url="$1" existing_key="$2" existing_model="$3" existing_proxy="$4"
  local use_proxy="${existing_proxy:-false}"

  if [[ -n "$existing_url" && "$existing_url" != "null" ]]; then
    info "Hiện tại: $existing_url | model: $existing_model"
    if confirm "Giữ config cũ?"; then
      # Offer proxy for ZingPlay even when keeping existing config
      if is_zingplay_url "$existing_url" && [[ "$use_proxy" != "true" ]]; then
        echo >&2
        warn "ZingPlay Chat dùng Qwen model với tool call format đặc biệt."
        dim "LLM Proxy sẽ chuyển đổi Qwen tool calls → OpenAI format cho PicoClaw."
        if confirm "Chạy LLM Proxy tự động?"; then
          use_proxy=true
        fi
      fi
      echo "${existing_url}|${existing_key}|${existing_model}|${use_proxy}"; return
    fi
  fi

  local presets=(
    "LM Studio        → http://localhost:1234/v1"
    "Ollama           → http://localhost:11434/v1"
    "LocalAI          → http://localhost:8080/v1"
    "llama.cpp        → http://localhost:8080/v1"
    "text-gen-webui   → http://localhost:5000/v1"
    "OpenRouter       → https://openrouter.ai/api/v1"
    "NVIDIA NIM       → https://integrate.api.nvidia.com/v1"
    "ZingPlay Chat    → https://chat.zingplay.com/api/v1"
    "Tự nhập URL khác"
  )
  local preset_urls=(
    "http://localhost:1234/v1"
    "http://localhost:11434/v1"
    "http://localhost:8080/v1"
    "http://localhost:8080/v1"
    "http://localhost:5000/v1"
    "https://openrouter.ai/api/v1"
    "https://integrate.api.nvidia.com/v1"
    "https://chat.zingplay.com/api/v1"
    ""
  )

  local idx; idx=$(choose "Server LLM của bạn:" "${presets[@]}")
  local base_url="${preset_urls[$idx]}"
  if [[ -z "$base_url" ]]; then
    local url_default="${LLM_BASE_URL:-http://localhost:1234/v1}"
    base_url=$(ask "Base URL (có /v1)" "$url_default")
  else
    base_url=$(ask "Base URL" "$base_url")
  fi
  [[ "$base_url" == http* ]] || base_url="http://$base_url"
  [[ "$base_url" == */v1* ]] || base_url="${base_url%/}/v1"

  # ZingPlay detection — offer LLM Proxy for Qwen tool-call conversion
  if is_zingplay_url "$base_url"; then
    echo >&2
    warn "ZingPlay Chat dùng Qwen model với tool call format đặc biệt."
    dim "LLM Proxy sẽ chuyển đổi Qwen tool calls → OpenAI format cho PicoClaw."
    if confirm "Chạy LLM Proxy tự động?"; then
      use_proxy=true
    else
      use_proxy=false
    fi
  else
    use_proxy=false
  fi

  # API key — priority: provider-specific env → generic LLM_API_KEY → prompt
  local api_key="not-needed"
  local is_local=false
  [[ "$base_url" == *localhost* || "$base_url" == *127.0.0.1* ]] && is_local=true

  if $is_local; then
    dim "-> Local server, bỏ qua API key."
  elif [[ -n "${NVIDIA_API_KEY:-}" && "$base_url" == *nvidia* ]]; then
    dim "-> Sử dụng NVIDIA_API_KEY từ .env"
    api_key="$NVIDIA_API_KEY"
  elif [[ -n "${LLM_API_KEY:-}" ]]; then
    dim "-> Sử dụng LLM_API_KEY từ .env"
    api_key="$LLM_API_KEY"
  else
    api_key=$(ask "API Key" "not-needed")
  fi

  # List models
  info "Lấy danh sách model..."
  local models_json; models_json=$(curl -fsSL \
    -H "Authorization: Bearer $api_key" \
    "${base_url}/models" 2>/dev/null || echo '{"data":[]}')

  local model_ids=()
  while IFS= read -r mid; do
    [[ -n "$mid" ]] && model_ids+=("$mid")
  done < <(jq -r ".data[].id" <<< "$models_json" 2>/dev/null | head -"$MAX_MODELS")

  local model=""
  if [[ ${#model_ids[@]} -gt 0 ]]; then
    ok "Models:"
    for i in "${!model_ids[@]}"; do
      echo -e "    ${CYN}$((i+1)))${R} ${model_ids[$i]}" >&2
    done
    echo >&2
    local pick; pick=$(ask "Chọn số hoặc gõ tên model")
    if [[ "$pick" =~ ^[0-9]+$ ]] && (( pick >= 1 && pick <= ${#model_ids[@]} )); then
      model="${model_ids[$((pick-1))]}"
    else
      model="$pick"
    fi
  else
    warn "Không lấy được danh sách model."
    model=$(ask "Nhập tên model")
  fi

  # Test connection (skip when proxy enabled — proxy uses OpenAI SDK)
  if [[ "$use_proxy" == "true" ]]; then
    dim "→ LLM Proxy sẽ xử lý kết nối. Bỏ qua test trực tiếp."
  else
    info "Test kết nối..."
    local test_payload; test_payload=$(jq -n --arg m "$model" '{
      model: $m,
      messages: [{role: "user", content: "Reply with exactly one word: OK"}],
      max_tokens: 20, temperature: 0
    }')
    local test_resp; test_resp=$(curl -fsSL --max-time 30 -X POST \
      "${base_url}/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $api_key" \
      -d "$test_payload" 2>/dev/null || echo '{}')
    local reply; reply=$(json_val "$test_resp" '.choices[0].message.content' 2>/dev/null || echo "")
    if [[ -n "$reply" ]]; then
      ok "Thành công! Reply: \"${reply:0:60}\""
    else
      warn "Lỗi kết nối. Kiểm tra server/URL/model."
      confirm "Vẫn tiếp tục?" "n" || { setup_llm "" "" "" ""; return; }
    fi
  fi

  echo "${base_url}|${api_key}|${model}|${use_proxy}"
}

# ── Architect prompt (constant) ────────────────────────────
ARCHITECT_PROMPT='You are ClawFather, an expert Telegram bot architect.
The user will describe a bot. Respond with ONLY a valid JSON object:
{
  "name": "short bot name (2-4 words)",
  "description": "1-line description",
  "system_prompt": "Complete system prompt. 200+ words. Include personality, rules, capabilities, format, language.",
  "welcome_message": "The /start greeting",
  "features": ["capability 1", "capability 2", "capability 3"],
  "pipeline": {"temperature": 0.7, "max_tokens": 1024}
}
RULES: system_prompt 200+ words, production-ready. Write in same language as user. Output ONLY JSON.'

# ── Setup: Bot Design ───────────────────────────────────────
design_bot() {
  local base_url="$1" api_key="$2" model="$3"
  step 3 4 "Thiết kế Bot"
  echo >&2
  dim "Mô tả bot muốn tạo. Ví dụ:"
  dim '  "Bot tư vấn sức khỏe, nhẹ nhàng, luôn khuyên đi khám bác sĩ"'
  dim '  "Bot dạy tiếng Anh cho người Việt, sửa lỗi ngữ pháp"'
  echo >&2

  local existing_name="$4" existing_prompt="$5"
  if [[ -n "$existing_name" && "$existing_name" != "null" ]]; then
    info "Bot hiện tại: $existing_name"
    if confirm "Giữ bot design cũ?"; then echo "KEEP"; return; fi
  fi

  while true; do
    local desc; desc=$(ask "Mô tả bot của bạn")
    [[ -n "$desc" ]] || { warn "Hãy mô tả bot."; continue; }

    info "AI đang thiết kế bot..."
    local payload; payload=$(jq -n \
      --arg model "$model" \
      --arg prompt "$ARCHITECT_PROMPT" \
      --arg user_msg "Tôi muốn tạo bot: $desc" \
      '{
        model: $model,
        messages: [
          {role: "system", content: $prompt},
          {role: "user", content: $user_msg}
        ],
        max_tokens: 4096,
        temperature: 0.7
      }')
    local resp; resp=$(curl -fsSL -X POST "${base_url}/chat/completions" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $api_key" \
      -d "$payload" 2>/dev/null || echo '{}')

    local content; content=$(json_val "$resp" '.choices[0].message.content' 2>/dev/null || echo "")
    if [[ -z "$content" ]]; then
      err "Không nhận được response từ LLM."
      confirm "Thử lại?" || { echo "{}"; return; }
      continue
    fi

    local bot_json; bot_json=$(echo "$content" | json_extract || echo "")
    if [[ -z "$bot_json" ]]; then
      err "AI không trả về JSON hợp lệ."
      confirm "Thử lại?" || { echo "{}"; return; }
      continue
    fi

    local bot_name; bot_name=$(json_val "$bot_json" '.name' 2>/dev/null || echo "Bot")
    local bot_desc; bot_desc=$(json_val "$bot_json" '.description' 2>/dev/null || echo "")

    echo >&2
    echo -e "  ${B}════════════════════════════════════════════════════════${R}" >&2
    echo -e "  ${B}${GRN}🤖 $bot_name${R}" >&2
    echo -e "  ${D}$bot_desc${R}" >&2
    echo -e "  ════════════════════════════════════════════════════════" >&2

    if confirm "Lưu bot design này?"; then
      echo "$bot_json"; return
    fi
    confirm "Thử lại?" || { echo "{}"; return; }
  done
}

# ── Setup: Skills ───────────────────────────────────────────
setup_skills() {
  step 4 4 "Skills"
  local existing="$1"

  [[ -d "$SKILLS_DIR" ]] || { warn "Không có skills/"; echo ""; return; }

  local skill_dirs=()
  local skill_names=()
  local skill_descs=()
  for d in "$SKILLS_DIR"/*/; do
    [[ -f "$d/SKILL.md" ]] || continue
    local name; name=$(basename "$d")
    skill_dirs+=("$d")
    skill_names+=("$name")
    # Parse description from front-matter
    local desc; desc=$(sed -n '/^---$/,/^---$/{ /^description:/s/description: *//p; }' "$d/SKILL.md")
    skill_descs+=("${desc:-$name}")
  done

  if [[ ${#skill_names[@]} -eq 0 ]]; then
    warn "Không tìm thấy skills."
    echo ""; return
  fi

  echo -e "\n  ${YEL}?${R} Chọn skills (nhập số, cách bằng dấu phẩy):" >&2
  for i in "${!skill_names[@]}"; do
    echo -e "    ${CYN}$((i+1)))${R} ${skill_names[$i]} ${D}— ${skill_descs[$i]}${R}" >&2
  done
  dim "Enter = tất cả, 0 = không chọn skill nào"

  local default_nums
  default_nums=$(seq -s, 1 "${#skill_names[@]}")
  local input; input=$(ask "Chọn (1-${#skill_names[@]})" "$default_nums")

  if [[ "$input" == "0" ]]; then echo ""; return; fi

  local selected=()
  IFS=',' read -ra nums <<< "$input"
  for n in "${nums[@]}"; do
    n=$(echo "$n" | tr -d ' ')
    [[ "$n" =~ ^[0-9]+$ ]] && (( n >= 1 && n <= ${#skill_names[@]} )) && selected+=("${skill_names[$((n-1))]}")
  done

  local IFS=','; echo "${selected[*]}"
}

# ── Config generation ───────────────────────────────────────
write_picoclaw_config() {
  local model="$1" base_url="$2" api_key="$3" telegram_token="$4"
  local temp="${5:-0.7}" max_tok="${6:-$DEFAULT_CONTEXT_WINDOW}"

  mkdir -p "$PICO_DIR"
  jq -n \
    --arg model "$model" \
    --arg api_base "$base_url" \
    --arg api_key "$api_key" \
    --arg token "$telegram_token" \
    --argjson temp "$temp" \
    --argjson max_tok "$max_tok" \
    --argjson web_max "$DEFAULT_WEB_MAX_RESULTS" \
    --argjson cron_timeout "$DEFAULT_CRON_TIMEOUT_MINUTES" \
    '{
      agents: {
        defaults: {
          workspace: "~/.picoclaw/workspace",
          restrict_to_workspace: false,
          provider: "openai",
          model: $model,
          max_tokens: $max_tok,
          temperature: $temp,
          max_tool_iterations: 20
        }
      },
      providers: {
        openai: {
          api_key: $api_key,
          api_base: $api_base
        }
      },
      channels: {
        telegram: {
          enabled: true,
          token: $token,
          allow_from: []
        }
      },
      tools: {
        web: {
          duckduckgo: { enabled: true, max_results: $web_max }
        },
        cron: {
          exec_timeout_minutes: $cron_timeout
        }
      }
    }' > "$PICO_CONFIG"
  ok "PicoClaw config: $PICO_CONFIG"
}

# Read SKILL.md body (after front-matter)
read_skill_body() {
  local file="$1"
  awk 'BEGIN{n=0} /^---$/{n++; next} n>=2{print}' "$file"
}

build_agents_md() {
  local bot_json="$1" skills_csv="$2"
  local name; name=$(json_val "$bot_json" '.name' 2>/dev/null || echo "Assistant")
  local prompt; prompt=$(json_val "$bot_json" '.system_prompt' 2>/dev/null || echo "You are a helpful assistant.")
  local features; features=$(jq -r '.features[]? | "- " + .' <<< "$bot_json" 2>/dev/null || true)

  {
    echo "# Agent: $name"
    echo
    echo "$prompt"
    if [[ -n "$features" ]]; then
      echo
      echo "## Capabilities"
      echo "$features"
    fi

    # Inline full skill content
    if [[ -n "$skills_csv" ]]; then
      echo
      echo "## Skills"
      echo
      echo "You have the following skills. Use the appropriate tools (read_file, write_file, exec, etc.) as described in each skill."
      echo

      IFS=',' read -ra skill_list <<< "$skills_csv"
      for skill in "${skill_list[@]}"; do
        local skill_file="$SKILLS_DIR/$skill/SKILL.md"
        [[ -f "$skill_file" ]] || continue
        echo "### $skill"
        echo
        read_skill_body "$skill_file"
        echo
        echo "---"
        echo
      done
    fi
  }
}

scaffold_workspace() {
  local bot_json="$1" skills_csv="$2"
  mkdir -p "$WORKSPACE" "$WORKSPACE/memory"

  # AGENTS.md — always regenerate
  build_agents_md "$bot_json" "$skills_csv" > "$WORKSPACE/AGENTS.md"
  ok "AGENTS.md"

  # IDENTITY.md — always regenerate
  local name; name=$(json_val "$bot_json" '.name' 2>/dev/null || echo "Assistant")
  local desc; desc=$(json_val "$bot_json" '.description' 2>/dev/null || echo "AI assistant")
  local welcome; welcome=$(json_val "$bot_json" '.welcome_message' 2>/dev/null || echo "Xin chào!")
  cat > "$WORKSPACE/IDENTITY.md" << IDEOF
# Identity

## Name
$name

## Description
$desc

## Welcome Message
$welcome
IDEOF

  # TOOLS.md — always regenerate
  cat > "$WORKSPACE/TOOLS.md" << 'TOOLSEOF'
# PicoClaw Tools Reference

## File System
- `read_file(path)` — Read file contents
- `write_file(path, content)` — Create/overwrite file
- `edit_file(path, old, new)` — Replace text in file
- `append_file(path, content)` — Append to file
- `list_dir(path)` — List directory

## Execution
- `exec <command>` — Run shell command

## Web
- `web_search(query)` — Search the internet
- `web_fetch(url)` — Fetch URL content

## Communication
- `message(text)` — Send message to user
- `spawn(prompt)` — Spawn background subagent

## Scheduling (native cron)

PicoClaw has a built-in cron tool. Use `picoclaw cron` commands via exec:

### Add by interval (seconds)
```
exec picoclaw cron add --name <name> --every <seconds> --message "<msg>" --deliver
```

### Add by cron expression
```
exec picoclaw cron add --name <name> --cron "<expr>" --message "<msg>" --deliver
```

### List / Remove
```
exec picoclaw cron list
exec picoclaw cron remove <id>
```

### Seconds conversion
- 60 = 1 minute, 300 = 5 minutes, 600 = 10 minutes
- 1800 = 30 minutes, 3600 = 1 hour, 7200 = 2 hours
- 86400 = 1 day

### Common cron patterns
| Pattern | Meaning |
|---------|---------|
| `0 9 * * *` | Every day at 9:00 |
| `0 9 * * 1-5` | Weekdays at 9:00 |
| `0 */2 * * *` | Every 2 hours |
| `30 8 * * 1` | Monday at 8:30 |
| `0 0 1 * *` | First day of month |

## Memory
- `memory/MEMORY.md` — Long-term notes
- Use read_file / write_file / append_file to manage
TOOLSEOF

  # Conditional files — create only if missing
  [[ -f "$WORKSPACE/SOUL.md" ]] || cat > "$WORKSPACE/SOUL.md" << 'EOF'
# Soul

## Personality
- Helpful and friendly
- Concise and to the point
- Honest and transparent

## Values
- Accuracy over speed
- User privacy and safety
- Continuous improvement
EOF

  [[ -f "$WORKSPACE/USER.md" ]] || cat > "$WORKSPACE/USER.md" << 'EOF'
# User

## Preferences
- Communication style: (casual/formal)
- Timezone: (your timezone)
- Language: (your preferred language)
EOF

  [[ -f "$WORKSPACE/HEARTBEAT.md" ]] || cat > "$WORKSPACE/HEARTBEAT.md" << 'EOF'
# Heartbeat Check List

Execute ALL tasks listed below. Use spawn for complex tasks.
Only respond HEARTBEAT_OK when all tasks are done.

---
Add heartbeat tasks below:
EOF

  [[ -f "$WORKSPACE/memory/MEMORY.md" ]] || echo "# Memory" > "$WORKSPACE/memory/MEMORY.md"
}

copy_skills() {
  local skills_csv="$1"
  [[ -n "$skills_csv" ]] || return 0

  local dest="$WORKSPACE/skills"
  mkdir -p "$dest"

  # Clean up deselected skills
  if [[ -d "$dest" ]]; then
    for d in "$dest"/*/; do
      [[ -d "$d" ]] || continue
      local sname; sname=$(basename "$d")
      if [[ ",$skills_csv," != *",$sname,"* ]]; then
        rm -rf "$d"
        dim "Removed: $sname"
      fi
    done
  fi

  # Copy selected skills
  local count=0
  IFS=',' read -ra skill_list <<< "$skills_csv"
  for skill in "${skill_list[@]}"; do
    local src="$SKILLS_DIR/$skill"
    [[ -d "$src" ]] || continue
    local sdest="$dest/$skill"
    mkdir -p "$sdest"
    cp -r "$src"/* "$sdest"/ 2>/dev/null || true
    chmod +x "$sdest"/*.sh 2>/dev/null || true
    count=$((count + 1))
  done

  ok "Skills: $count copied"
}

# ── Main ────────────────────────────────────────────────────
main() {
  banner

  # Check dependencies
  command -v curl &>/dev/null || { err "Cần curl."; exit 1; }
  ensure_jq

  local picoclaw; picoclaw=$(ensure_picoclaw)
  echo

  # Load existing config
  local cfg; cfg=$(load_config)
  local ex_token; ex_token=$(json_val "$cfg" '.telegram_token' 2>/dev/null || echo "")
  local ex_url; ex_url=$(json_val "$cfg" '.llm_base_url' 2>/dev/null || echo "")
  local ex_key; ex_key=$(json_val "$cfg" '.llm_api_key' 2>/dev/null || echo "")
  local ex_model; ex_model=$(json_val "$cfg" '.llm_model' 2>/dev/null || echo "")
  local ex_bot; ex_bot=$(json_val "$cfg" '.bot' 2>/dev/null || echo "{}")
  local ex_name; ex_name=$(json_val "$cfg" '.bot.name' 2>/dev/null || echo "")
  local ex_prompt; ex_prompt=$(json_val "$cfg" '.bot.system_prompt' 2>/dev/null || echo "")
  local ex_skills; ex_skills=$(json_val "$cfg" '.skills' 2>/dev/null || echo "")
  local ex_proxy; ex_proxy=$(json_val "$cfg" '.use_proxy' 2>/dev/null || echo "false")

  # Step 1: Telegram
  local telegram_token; telegram_token=$(setup_telegram "$ex_token")

  # Step 2: LLM
  local llm_result; llm_result=$(setup_llm "$ex_url" "$ex_key" "$ex_model" "$ex_proxy")
  local base_url api_key model use_proxy
  IFS='|' read -r base_url api_key model use_proxy <<< "$llm_result"
  use_proxy="${use_proxy:-false}"

  # Start LLM Proxy early so bot design API calls go through it too
  local llm_url="$base_url"
  if [[ "$use_proxy" == "true" ]]; then
    if start_llm_proxy "$base_url" "$api_key"; then
      trap stop_llm_proxy EXIT
      llm_url="$PROXY_URL"
    else
      warn "Proxy lỗi. Dùng kết nối trực tiếp."
    fi
  fi

  # Step 3: Bot design
  local bot_json
  local design_result; design_result=$(design_bot "$llm_url" "$api_key" "$model" "$ex_name" "$ex_prompt")
  if [[ "$design_result" == "KEEP" ]]; then
    bot_json="$ex_bot"
  else
    bot_json="$design_result"
  fi

  # Step 4: Skills
  local skills_csv; skills_csv=$(setup_skills "$ex_skills")

  # Save local config
  mkdir -p "$DATA_DIR"
  local safe_bot="$bot_json"
  [[ -n "$safe_bot" ]] && jq '.' <<< "$safe_bot" >/dev/null 2>&1 || safe_bot="{}"
  jq -n \
    --arg token "$telegram_token" \
    --arg url "$base_url" \
    --arg key "$api_key" \
    --arg model "$model" \
    --argjson proxy "$use_proxy" \
    --argjson bot "$safe_bot" \
    --arg skills "$skills_csv" \
    '{
      telegram_token: $token,
      llm_base_url: $url,
      llm_api_key: $key,
      llm_model: $model,
      use_proxy: $proxy,
      bot: $bot,
      skills: $skills
    }' > "$CONFIG_FILE"

  # Generate PicoClaw config
  local bot_temp; bot_temp=$(json_val "$bot_json" '.pipeline.temperature' 2>/dev/null || echo "0.7")
  local bot_maxtok; bot_maxtok=$(json_val "$bot_json" '.pipeline.max_tokens' 2>/dev/null || echo "$DEFAULT_CONTEXT_WINDOW")
  # Enforce minimum context window — PicoClaw uses max_tokens as context window
  (( bot_maxtok < DEFAULT_CONTEXT_WINDOW )) && bot_maxtok="$DEFAULT_CONTEXT_WINDOW"
  local pico_url="$base_url"
  [[ -n "${PROXY_PID:-}" ]] && pico_url="$PROXY_URL"
  write_picoclaw_config "$model" "$pico_url" "$api_key" "$telegram_token" "$bot_temp" "$bot_maxtok"

  # Scaffold workspace
  scaffold_workspace "$bot_json" "$skills_csv"
  copy_skills "$skills_csv"

  # Launch
  echo
  echo -e "  ${B}${GRN}════════════════════════════════════════════════════════${R}"
  echo -e "  ${B}${GRN}  🦞 Launching PicoClaw Gateway${R}"
  [[ -n "${PROXY_PID:-}" ]] && echo -e "  ${GRN}  LLM Proxy: port $PROXY_PORT${R}"
  echo -e "  ${GRN}  Ctrl+C để dừng${R}"
  echo -e "  ${B}${GRN}════════════════════════════════════════════════════════${R}"
  echo

  # Export picoclaw path so skill scripts can find it via PICOCLAW_BIN
  export PICOCLAW_BIN="$picoclaw"

  if [[ -n "${PROXY_PID:-}" ]]; then
    "$picoclaw" gateway
  else
    exec "$picoclaw" gateway
  fi
}

main "$@"
