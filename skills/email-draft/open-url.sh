#!/bin/bash
# Opens a URL in the default browser (cross-platform)
URL="$1"
if [ -z "$URL" ]; then
  echo "Usage: open-url.sh <URL>"
  exit 1
fi
case "$(uname -s)" in
  Darwin*)       open "$URL" ;;
  Linux*)        xdg-open "$URL" 2>/dev/null || sensible-browser "$URL" ;;
  MINGW*|MSYS*)  cmd.exe /c start "" "$URL" ;;
  *)             echo "Unsupported OS: $(uname -s)" && exit 1 ;;
esac
