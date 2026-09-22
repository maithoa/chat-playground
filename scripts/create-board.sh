
#!/usr/bin/env bash
# -------------------------------------------------------------------------
# create-board.sh
#   • Accepts a GitHub Project URL (user‑level Projects v2) as the only arg.
#   • Handles plain URLs as well as the markdown form @url:`…`.
#   • If the project does not exist → creates it.
#   • Guarantees the four classic Kanban columns (To Do, In Progress,
#     Blocked, Done) are present (creates any missing ones).
#   • Uses the GitHub CLI (gh); you must be logged in (gh auth login).
# -------------------------------------------------------------------------

set -euo pipefail

die() { echo "❌ $*" >&2; exit 1; }

# ---------- 0️⃣  Helper: strip possible markdown wrappers ----------
clean_url() {
  local raw="$1"
  # Remove a leading "@url:" if someone copies the markdown link
  raw="${raw#@url:}"
  # Strip surrounding back‑ticks (or single quotes) – both sides
  raw="${raw%\`}"   # trailing back‑tick
  raw="${raw#\`}"   # leading back‑tick
  raw="${raw%\"}"   # trailing double‑quote (just in case)
  raw="${raw#\"}"   # leading double‑quote
  raw="${raw%\'}"   # trailing single‑quote
  raw="${raw#\'}"   # leading single‑quote
  echo "$raw"
}

# ---------- 1️⃣  Parse the argument ----------
if [[ $# -ne 1 ]]; then
  die "Usage: $0 <project‑url>
Example: $0 https://github.com/users/maithoa/projects/1"
fi

PROJECT_URL_RAW="$1"
PROJECT_URL="$(clean_url "$PROJECT_URL_RAW")"

# Expected forms:
#   https://github.com/users/<login>/projects/<num>
#   https://github.com/orgs/<org>/projects/<num>
#   https://github.com/<owner>/projects/<num>
if [[ "$PROJECT_URL" =~ github\.com/+(users/)?([^/]+)/projects/([0-9]+) ]]; then
  OWNER="${BASH_REMATCH[2]}"
  PROJ_NUM="${BASH_REMATCH[3]}"
  echo "Owner: $OWNER" 
  echo "Project_num : $PROJ_NUM"
else
  die "Could not parse a valid GitHub Project URL: $PROJECT_URL"
fi

echo "🔎 Parsed URL → owner: $OWNER , project number: $PROJ_NUM"

# ---------- 2️⃣  Resolve the owner’s GraphQL node ID ----------
OWNER_ID=$(gh api graphql -f query='
  query($login: String!){
    user(login: $login){ id }
    organization(login: $login){ id }
  }' -f login="$OWNER" -q '
    .data.user?.id // user case
    // fallback to org case
    .data.organization?.id
  ' 2>/dev/null || true)

if [[ -z "$OWNER_ID" ]]; then
  die "Unable to resolve owner \"$OWNER\" to a GitHub node ID."
fi
echo "👤 Owner node ID = $OWNER_ID"

# ---------- 3️⃣  Check whether the project already exists ----------
PROJECT_ID=$(gh api graphql -f query='
  query($owner: String!, $num: Int!){
    user(login: $owner){ projectV2(number: $num){ id } }
    organization(login: $owner){ projectV2(number: $num){ id } }
  }' -f owner="$OWNER" -f num=$PROJ_NUM -q '
    .data.user?.projectV2?.id
    // fallback to org
    .data.organization?.projectV2?.id
  ' 2>/dev/null || true)

if [[ -n "$PROJECT_ID" ]]; then
  echo "✅ Project already exists – node ID = $PROJECT_ID"
else
  echo "🚧 Project does NOT exist – creating a new one…"
  PROJECT_ID=$(gh api graphql -f query='
    mutation($ownerId: ID!, $title: String!){
      createProjectV2(input:{ownerId:$ownerId, title:$title, public:true}){
        projectV2{ id }
      }
    }' -f ownerId="$OWNER_ID" -f title="Chat Playground – Sprint Board" -q '
      .data.createProjectV2.projectV2.id
    ')
  echo "🆕 Created new project – node ID = $PROJECT_ID"
fi

# ---------- 4️⃣  Ensure the four columns exist ----------
# Pull existing column names (and IDs) so we don’t duplicate them.
mapfile -t EXISTING_COLUMNS < <(
  gh api graphql -f query='
    query($projectId: ID!){
      node(id: $projectId){
        ... on ProjectV2{
          columns(first:100){
            nodes{ id name }
          }
        }
      }
    }' -f projectId="$PROJECT_ID" -q '
      .data.node.columns.nodes[]
      | "\(.name)||\(.id)"
    ' 2>/dev/null
)

declare -A COL_NAME_TO_ID
for line in "${EXISTING_COLUMNS[@]}"; do
  name="${line%%||*}"
  id="${line##*||}"
  COL_NAME_TO_ID["$name"]="$id"
done

COLUMNS=("To Do" "In Progress" "Blocked" "Done")
for col in "${COLUMNS[@]}"; do
  if [[ -n "${COL_NAME_TO_ID[$col]:-}" ]]; then
    echo "✅ Column already exists: $col"
    continue
  fi
  echo "➕ Creating column: $col"
  gh api graphql -f query='
    mutation($projectId: ID!, $name: String!){
      addProjectV2Column(input:{projectId:$projectId, name:$name}){
        columnEdge{ node{ id name } }
      }
    }' -f projectId="$PROJECT_ID" -f name="$col" >/dev/null 2>&1 \
    && echo "   → $col added"
done

# ---------- 5️⃣  Final public URL ----------
FINAL_URL="https://github.com/users/$OWNER/projects/$PROJ_NUM"
echo "✅✅✅ Board ready! Open it at: $FINAL_URL"