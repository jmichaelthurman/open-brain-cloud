#!/usr/bin/env bash
# rotate-api-key.sh
#
# Rotates OPEN_BRAIN_API_KEY in all four locations atomically:
#   1. Fly.io secrets  (live server)
#   2. .env            (local dev / docker)
#   3. ~/.claude/mcp_settings.json  (Claude Code CLI)
#   4. ~/Library/Application Support/Claude/claude_desktop_config.json (Desktop)
#
# Usage:
#   ./scripts/rotate-api-key.sh            # generates a new key
#   ./scripts/rotate-api-key.sh <new-key>  # use a specific key (testing)
#
# Requirements: fly CLI, jq, openssl

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"
MCP_SETTINGS="${HOME}/.claude/mcp_settings.json"
DESKTOP_CONFIG="${HOME}/Library/Application Support/Claude/claude_desktop_config.json"
FLY_APP="open-brain-cloud"

# ── Generate or accept new key ───────────────────────────────────────────────
if [[ "${1:-}" != "" ]]; then
  NEW_KEY="$1"
  echo "Using provided key."
else
  NEW_KEY="$(openssl rand -hex 32)"
  echo "Generated new key."
fi

# ── 1. Fly.io secrets ────────────────────────────────────────────────────────
echo "→ Updating Fly.io secret..."
fly secrets set "OPEN_BRAIN_API_KEY=${NEW_KEY}" --app "${FLY_APP}" --stage
echo "  Staged (will apply on next deploy or restart)."
echo "  To apply immediately: fly secrets deploy --app ${FLY_APP}"

# ── 2. .env ──────────────────────────────────────────────────────────────────
echo "→ Updating ${ENV_FILE}..."
if [[ -f "${ENV_FILE}" ]]; then
  if grep -q "^OPEN_BRAIN_API_KEY=" "${ENV_FILE}"; then
    # Replace existing line in-place
    sed -i '' "s|^OPEN_BRAIN_API_KEY=.*|OPEN_BRAIN_API_KEY=${NEW_KEY}|" "${ENV_FILE}"
  else
    # Append if not present
    echo "OPEN_BRAIN_API_KEY=${NEW_KEY}" >> "${ENV_FILE}"
  fi
  echo "  Updated."
else
  echo "  .env not found — skipping."
fi

# ── 3. ~/.claude/mcp_settings.json ───────────────────────────────────────────
echo "→ Updating ${MCP_SETTINGS}..."
if [[ -f "${MCP_SETTINGS}" ]]; then
  TMP="$(mktemp)"
  jq --arg key "${NEW_KEY}" \
    '.mcpServers["open-brain"].headers.Authorization = ("Bearer " + $key)' \
    "${MCP_SETTINGS}" > "${TMP}" && mv "${TMP}" "${MCP_SETTINGS}"
  echo "  Updated."
else
  echo "  mcp_settings.json not found — skipping."
fi

# ── 4. Claude Desktop config ─────────────────────────────────────────────────
echo "→ Updating ${DESKTOP_CONFIG}..."
if [[ -f "${DESKTOP_CONFIG}" ]]; then
  TMP="$(mktemp)"
  jq --arg key "${NEW_KEY}" \
    '.mcpServers["open-brain"].env.OPEN_BRAIN_API_KEY = $key' \
    "${DESKTOP_CONFIG}" > "${TMP}" && mv "${TMP}" "${DESKTOP_CONFIG}"
  echo "  Updated."
else
  echo "  claude_desktop_config.json not found — skipping."
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "✓ Key rotation complete."
echo ""
echo "Next steps:"
echo "  1. Deploy key to Fly now:  fly secrets deploy --app ${FLY_APP}"
echo "  2. Restart Claude Desktop to pick up the new key"
echo "  3. Reload Claude Code MCP: /mcp restart (or restart Claude Code)"
echo ""
echo "New key prefix (first 8 chars): ${NEW_KEY:0:8}..."
