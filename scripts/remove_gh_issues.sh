#!/usr/bin/env bash
set -euo pipefail

# Load environment variables from .env if present
ENV_PATH="$(dirname "${BASH_SOURCE[0]}")/../.env"

if [[ -f "$ENV_PATH" ]]; then
  # shellcheck disable=SC1091
  source "$ENV_PATH"
fi

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Error: GITHUB_TOKEN environment variable not set" >&2
  exit 1
fi

if [[ -z "${GITHUB_PROJECT_URL:-}" ]]; then
  echo "Error: GITHUB_PROJECT_URL environment variable not set" >&2
  exit 1
fi

if [[ -z "${GITHUB_REPO:-}" ]]; then
  echo "Error: GITHUB_REPO environment variable not set" >&2
  exit 1
fi

if [[ -z "${GITHUB_OWNER:-}" ]]; then
  echo "Error: GITHUB_OWNER environment variable not set" >&2
  exit 1
fi

OWNER="${GITHUB_OWNER}"
REPO_SLUG="${GITHUB_OWNER}/${GITHUB_REPO}"
PROJECT_URL="${GITHUB_PROJECT_URL}"
PROJECT_NUM="$(basename "$PROJECT_URL")"

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <id|range> [id|range ...]" >&2
  echo "Example: $0 1..16" >&2
  echo "Example: $0 1 3..5 10" >&2
  exit 1
fi

# Expand parameters (e.g., 1..5 8 -> array of target IDs)
target_ids=()
for arg in "$@"; do
  if [[ $arg =~ ^([0-9]+)\.\.([0-9]+)$ ]]; then
    start="${BASH_REMATCH[1]}"
    end="${BASH_REMATCH[2]}"
    for (( i=start; i<=end; i++ )); do
      target_ids+=("$i")
    done
  elif [[ $arg =~ ^[0-9]+$ ]]; then
    target_ids+=("$arg")
  else
    echo "⚠️ Skipping invalid parameter: $arg" >&2
  fi
done

echo "Targeting issues: ${target_ids[*]}"
echo "Fetching project items to check attachments..."

# 1. Map toàn bộ item hiện có trên Project Board vào associative array
declare -A project_item_ids

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  item_id=$(echo "$line" | jq -r '.id')
  content_url=$(echo "$line" | jq -r '.content.url // empty')
  
  if [[ -n "$content_url" ]]; then
    issue_num="${content_url##*/}"
    project_item_ids["$issue_num"]="$item_id"
  fi
done < <(gh project item-list "$PROJECT_NUM" --owner "$OWNER" --format json | jq -c '.items[]')

# 2. Xóa từng Issue ID mục tiêu
for i in "${target_ids[@]}"; do
  echo "----------------------------------------"
  echo "Processing Issue #$i..."

  # Nếu issue có nằm trong Project -> Xóa khỏi Project trước
  if [[ -n "${project_item_ids[$i]:-}" ]]; then
    p_item_id="${project_item_ids[$i]}"
    echo "  -> Removing from Project Board (Item ID: $p_item_id)..."
    gh project item-delete "$PROJECT_NUM" --owner "$OWNER" --id "$p_item_id" || echo "⚠️ Could not delete item from project"
  else
    echo "  -> Issue #$i is not attached to Project Board."
  fi

  # Xóa Issue hoàn toàn khỏi Repository
  echo "  -> Deleting Issue #$i from repository ($REPO_SLUG)..."
  if gh issue delete "$i" --repo "$REPO_SLUG" --yes 2>/dev/null; then
    echo "  ✅ Deleted Issue #$i successfully."
  else
    echo "  ⚠️ Issue #$i does not exist in repository or already deleted."
  fi
done

echo "----------------------------------------"
echo "Done!"