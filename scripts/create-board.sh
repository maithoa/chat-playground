#!/usr/bin/env bash

# This script reads EPICS.md and creates GitHub issues for epics, user stories, and tasks.
# It expects GITHUB_TOKEN, GITHUB_PROJECT_URL, and GITHUB_OWNER to be set in environment / .env.

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

REPO_SLUG="${1:-}"
if [[ -z "$REPO_SLUG" ]]; then
  echo "Usage: $0 <owner/repo>" >&2
  exit 1
fi

# Determine Owner: use GITHUB_OWNER if present, otherwise extract from REPO_SLUG
OWNER="${GITHUB_OWNER:-${REPO_SLUG%%/*}}"

EPICS_FILE="EPICS.md"
PROJECT_URL="${GITHUB_PROJECT_URL}"

# Extract project number from URL
PROJECT_NUM="$(basename "$PROJECT_URL")"

if [[ ! -f "$EPICS_FILE" ]]; then
  echo "Error: $EPICS_FILE not found!" >&2
  exit 1
fi

# Authenticate gh with token
export GH_TOKEN="${GITHUB_TOKEN:-}"

current_epic=""
epic_number=""
story_counter=0

declare -A EPIC_URLS
declare -A STORY_URLS

while IFS= read -r line || [[ -n "$line" ]]; do
  # Detect epic header
  if [[ $line =~ ^##[[:space:]]*Epic[[:space:]]*([0-9]+):[[:space:]]*(.*) ]]; then
    epic_number="${BASH_REMATCH[1]}"
    epic_title="${BASH_REMATCH[2]}"
    current_epic="Epic ${epic_number}: ${epic_title}"
    story_counter=0 # Reset story counter for each epic

    epic_issue_title="Epic ${epic_number}: ${epic_title}"
    epic_body="Generated from EPICS.md. This epic groups related user stories."
    echo "Creating Epic issue: $epic_issue_title"
    epic_url=$(gh issue create --repo "$REPO_SLUG" --title "$epic_issue_title" --body "$epic_body" --label "epic")
    echo "Created Epic: $epic_url"
    EPIC_URLS[${epic_number}]="$epic_url"
    continue
  fi

  # Detect user story lines
  if [[ $line =~ ^[0-9]+\.[[:space:]]*\*\*As[[:space:]]*a[[:space:]]*(.*)\*\* ]]; then
    story_desc="${BASH_REMATCH[1]}"
    ((story_counter++))

    story_title="User Story: As a ${story_desc}"
    
    story_body=$(cat <<EOF
Generated from EPICS.md under ${current_epic}.

Parent Epic: ${EPIC_URLS[${epic_number}]:-N/A}
EOF
)

    echo "Creating User Story issue: $story_title"
    story_url=$(gh issue create --repo "$REPO_SLUG" --title "$story_title" --body "$story_body" --label "user-story")
    echo "Created User Story: $story_url"
    
    STORY_URLS["${epic_number}_${story_counter}"]="$story_url"

    if gh project item-add "$PROJECT_NUM" --owner "$OWNER" --url "$story_url" >/dev/null 2>&1; then
      echo "Added User Story to Project #$PROJECT_NUM"
    else
      echo "⚠️ Could not auto‑add to project. Add manually: $PROJECT_URL"
    fi
    continue
  fi
done < "$EPICS_FILE"

# ---------------------------------------------------------------------------
# Create Task issues based on PROJECT_PLAN.md
# ---------------------------------------------------------------------------

PROJECT_PLAN="PROJECT_PLAN.md"
if [[ -f "$PROJECT_PLAN" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ $line =~ ^[0-9]+[[:space:]]+([^\t]+)[[:space:]]+(.*)$ ]]; then
      task_desc="${BASH_REMATCH[1]}"
      epic_ref="${BASH_REMATCH[2]}"

      ref_epic_num=""
      if [[ $epic_ref =~ Epic[^0-9]*([0-9]+) ]]; then
        ref_epic_num="${BASH_REMATCH[1]}"
      fi

      story_num=""
      if [[ $epic_ref =~ Story[^0-9]*([0-9]+) ]]; then
        story_num="${BASH_REMATCH[1]}"
      fi

      [[ -z "$ref_epic_num" ]] && continue

      parent_epic_url="${EPIC_URLS[$ref_epic_num]:-N/A}"
      related_story_url="${STORY_URLS[${ref_epic_num}_${story_num}]:-}"

      task_body="Task generated from PROJECT_PLAN.md.\n\nParent Epic: ${parent_epic_url}"
      if [[ -n "$related_story_url" ]]; then
        task_body="${task_body}\nRelated User Story: ${related_story_url}"
      fi

      task_title="Task: ${task_desc}"
      echo "Creating Task issue: $task_title"
      task_url=$(gh issue create --repo "$REPO_SLUG" --title "$task_title" --body "$(echo -e "$task_body")" --label "task")
      echo "Created Task: $task_url"

      if gh project item-add "$PROJECT_NUM" --owner "$OWNER" --url "$task_url" >/dev/null 2>&1; then
        echo "Added Task to Project #$PROJECT_NUM"
      else
        echo "⚠️ Could not auto‑add task to project. Add manually: $PROJECT_URL"
      fi
    fi
  done < "$PROJECT_PLAN"
else
  echo "⚠️ PROJECT_PLAN.md not found – skipping task creation."
fi

echo "All epics, user stories, and tasks processed successfully."