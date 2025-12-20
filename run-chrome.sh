#!/usr/bin/env bash
PORT=9222

# Function to check if debug port is ready
is_debug_port_ready() {
  lsof -i :$PORT -sTCP:LISTEN >/dev/null 2>&1
}

# Get the actual default Chrome profile path
get_default_chrome_profile() {
  local profile_path=""
  
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - get the most recently used profile
    local config_dir="$HOME/.config/google-chrome"
    if [ -d "$config_dir" ]; then
      profile_path=$(find "$config_dir" -name "Preferences" -path "*/Default/*" -o -name "Preferences" -path "*/Profile */*" | \
        xargs ls -t 2>/dev/null | head -1 | xargs dirname 2>/dev/null || echo "")
    fi
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    local config_dir="$HOME/Library/Application Support/Google/Chrome"
    if [ -d "$config_dir" ]; then
      profile_path=$(find "$config_dir" -name "Preferences" -path "*/Default/*" -o -name "Preferences" -path "*/Profile */*" | \
        xargs ls -t 2>/dev/null | head -1 | xargs dirname 2>/dev/null || echo "")
    fi
  fi
  
  echo "$profile_path"
}

# First, check if debug port is already available
if is_debug_port_ready; then
  echo "Debug-enabled Chrome already running"
  exit 0
fi

# Check if regular Chrome is running
if pgrep -f "google-chrome.*type=renderer" >/dev/null; then
  echo "Warning: Chrome is already running with your default profile."
  echo "To use the debug port, you need to:"
  echo "1. Close all Chrome windows completely"
  echo "2. Run this script again"
  echo ""
  read -p "Do you want to close Chrome now? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Closing Chrome..."
    pkill -f "google-chrome"
    sleep 3
  else
    exit 1
  fi
fi

# Get default profile path
DEFAULT_PROFILE=$(get_default_chrome_profile)
CHROME_ARGS=(
  "--remote-debugging-port=$PORT"
  "--remote-debugging-address=127.0.0.1"
  "--no-first-run"
  "--no-default-browser-check"
)

# Use specific profile if found, otherwise let Chrome use default
if [ -n "$DEFAULT_PROFILE" ]; then
  echo "Launching Chrome with your default profile: $(basename "$DEFAULT_PROFILE")"
  CHROME_ARGS+=("--user-data-dir=$(dirname "$DEFAULT_PROFILE")")
  CHROME_ARGS+=("--profile-directory=$(basename "$DEFAULT_PROFILE")")
else
  echo "Launching Chrome with default profile..."
fi

# Launch Chrome
google-chrome "${CHROME_ARGS[@]}" >/dev/null 2>&1 &
CHROME_PID=$!

# Wait for debug port
echo "Waiting for Chrome debug port..."
for i in {1..30}; do
  if is_debug_port_ready; then
    echo "Chrome debug port ready with your default profile!"
    echo "You should see all your bookmarks, extensions, and logged-in sessions."
    exit 0
  fi
  if ! kill -0 $CHROME_PID 2>/dev/null; then
    echo "Chrome process died unexpectedly" >&2
    exit 1
  fi
  sleep 1
done

echo "Chrome failed to start debug port within 30 seconds" >&2
kill $CHROME_PID 2>/dev/null || true
exit 1