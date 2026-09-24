#!/usr/bin/env bash

set -u

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

REPO_SLUG="${1:-${GITHUB_OWNER:-}/${GITHUB_REPO:-}}"
if [[ -z "$REPO_SLUG" || "$REPO_SLUG" == "/" ]]; then
  echo "Usage: $0 <owner/repo>" >&2
  exit 1
fi

OWNER="${GITHUB_OWNER:-${REPO_SLUG%%/*}}"
EPICS_FILE="EPICS.md"
PROJECT_URL="${GITHUB_PROJECT_URL}"
PROJECT_NUM="$(basename "$PROJECT_URL")"

if [[ ! -f "$EPICS_FILE" ]]; then
  echo "Error: $EPICS_FILE not found!" >&2
  exit 1
fi

export GH_TOKEN="${GITHUB_TOKEN:-}"

# 1. Query GraphQL Metadata của Project & lấy Field ID của "Status" + Option ID của "Backlog"
echo "Fetching Project Metadata for Project #$PROJECT_NUM..."
PROJECT_META=$(gh api graphql -f query='
query($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) {
      id
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
}' -F owner="$OWNER" -F number="$PROJECT_NUM" 2>/dev/null || true)

PROJECT_ID=$(echo "$PROJECT_META" | jq -r '.data.user.projectV2.id // empty')

if [[ -z "$PROJECT_ID" ]]; then
  echo "Error: Could not retrieve GraphQL Project ID for user '$OWNER' and project #$PROJECT_NUM" >&2
  exit 1
fi

STATUS_FIELD_ID=$(echo "$PROJECT_META" | jq -r '.data.user.projectV2.fields.nodes[] | select(.name=="Status") | .id // empty')
BACKLOG_OPTION_ID=$(echo "$PROJECT_META" | jq -r '.data.user.projectV2.fields.nodes[] | select(.name=="Status") | .options[] | select(.name=="Backlog" or .name=="Todo" or .name=="To Do") | .id // empty' | head -n 1)

echo "Project ID: $PROJECT_ID"
echo "Status Field ID: ${STATUS_FIELD_ID:-Not Found}"
echo "Backlog Option ID: ${BACKLOG_OPTION_ID:-Not Found}"

# Ensure required labels exist
for label in "epic" "user-story" "task"; do
  gh label create "$label" --repo "$REPO_SLUG" --force >/dev/null 2>&1 || true
done

current_epic=""
epic_number=""
story_counter=0

declare -A EPIC_URLS
declare -A STORY_URLS

# Hàm thêm Issue vào Project Board và gán Status = Backlog
add_issue_to_project() {
  local issue_url="$1"
  local issue_num="$(basename "$issue_url")"
  
  local issue_id
  issue_id=$(gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) { id }
    }
  }' -F owner="$OWNER" -F repo="${REPO_SLUG#*/}" -F number="$issue_num" --jq '.data.repository.issue.id' 2>/dev/null || true)

  if [[ -n "$issue_id" && "$issue_id" != "null" ]]; then
    # Add Item vào Project Board
    local item_id
    item_id=$(gh api graphql -f query='
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item { id }
      }
    }' -F projectId="$PROJECT_ID" -F contentId="$issue_id" --jq '.data.addProjectV2ItemById.item.id' 2>/dev/null || true)

    if [[ -n "$item_id" ]]; then
      # Set Status = Backlog
      if [[ -n "$STATUS_FIELD_ID" && -n "$BACKLOG_OPTION_ID" ]]; then
        gh api graphql -f query='
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: { singleSelectOptionId: $optionId }
          }) {
            projectV2Item { id }
          }
        }' -F projectId="$PROJECT_ID" -F itemId="$item_id" -F fieldId="$STATUS_FIELD_ID" -F optionId="$BACKLOG_OPTION_ID" >/dev/null 2>&1
      fi
      echo "✅ Added Issue #$issue_num -> Project Board (Status: Backlog)"
    else
      echo "⚠️ Failed to add Issue #$issue_num to Project Board"
    fi
  else
    echo "⚠️ Could not fetch GraphQL ID for Issue #$issue_num"
  fi
}

echo "=== Processing EPICS.md ==="

while IFS= read -r line || [[ -n "$line" ]]; do
  line_clean=$(echo "$line" | tr -d '\r' | xargs)
  [[ -z "$line_clean" ]] && continue

  if [[ "$line_clean" =~ ^##[[:space:]]*Epic[[:space:]]*([0-9]+):[[:space:]]*(.*) ]]; then
    epic_number="${BASH_REMATCH[1]}"
    epic_title="${BASH_REMATCH[2]}"
    current_epic="Epic ${epic_number}: ${epic_title}"
    story_counter=0

    epic_issue_title="Epic ${epic_number}: ${epic_title}"
    epic_body="Generated from EPICS.md. Groups related user stories."
    
    echo "------------------------------------------------"
    echo "Creating Epic: $epic_issue_title"
    epic_url=$(gh issue create --repo "$REPO_SLUG" --title "$epic_issue_title" --body "$epic_body" --label "epic")
    echo "Created: $epic_url"
    
    EPIC_URLS["$epic_number"]="$epic_url"
    continue
  fi

  if [[ "$line_clean" =~ ^[0-9]+\.[[:space:]]*(.*) ]]; then
    raw_content="${BASH_REMATCH[1]}"
    clean_desc=$(echo "$raw_content" | sed 's/\*\*//g')
    
    story_counter=$((story_counter + 1))
    story_title="User Story: ${clean_desc}"
    
    parent_url="${EPIC_URLS[$epic_number]:-N/A}"
    story_body="Generated from EPICS.md under ${current_epic}.\n\nParent Epic: ${parent_url}"

    echo "Creating User Story #${story_counter} (Epic ${epic_number}): ${clean_desc}"
    story_url=$(gh issue create --repo "$REPO_SLUG" --title "$story_title" --body "$(echo -e "$story_body")" --label "user-story")
    echo "Created: $story_url"
    
    STORY_URLS["${epic_number}_${story_counter}"]="$story_url"

    add_issue_to_project "$story_url"
    continue
  fi

done < "$EPICS_FILE"

echo "------------------------------------------------"
echo "=== Processing PROJECT_PLAN.md ==="

PROJECT_PLAN="PROJECT_PLAN.md"
if [[ -f "$PROJECT_PLAN" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line_clean=$(echo "$line" | tr -d '\r' | xargs)
    [[ -z "$line_clean" ]] && continue

    if [[ "$line_clean" =~ ^[0-9]+[[:space:]]+([^\t]+)[[:space:]]+(.*)$ ]]; then
      task_desc="${BASH_REMATCH[1]}"
      epic_ref="${BASH_REMATCH[2]}"

      ref_epic_num=""
      if [[ "$epic_ref" =~ Epic[^0-9]*([0-9]+) ]]; then
        ref_epic_num="${BASH_REMATCH[1]}"
      fi

      story_num=""
      if [[ "$epic_ref" =~ Story[^0-9]*([0-9]+) ]]; then
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
      echo "Creating Task: $task_title"
      task_url=$(gh issue create --repo "$REPO_SLUG" --title "$task_title" --body "$(echo -e "$task_body")" --label "task")
      echo "Created: $task_url"

      add_issue_to_project "$task_url"
    fi
  done < "$PROJECT_PLAN"
fi

echo "=== Processing Complete! ==="