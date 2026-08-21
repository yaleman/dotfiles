#!/usr/bin/env bash
set -euo pipefail

echo "Fetching unread GitHub notifications..."

gh api --paginate notifications \
  --jq '
    .[]
    | select(.unread == true)
    | select(.subject.type == "PullRequest")
    | [
        (.id | tostring),
        (.repository.full_name | tostring),
        (.subject.url | split("/")[-1] | tostring),
        (.subject.title | tostring)
      ]
    | @tsv
  ' |
while IFS=$'\t' read -r thread_id repo pr_number title; do
    printf 'id=[%s] repo=[%s] pr=[%s] title=[%s]\n' \
      "$thread_id" "$repo" "$pr_number" "$title"

    # Dependabot/Renovate-ish detection
    if ! echo "$title" | grep -Eiq \
        '(dependabot|renovate|bump .* from .* to|update .* requirement)'; then
        continue
    fi

    echo
    echo "Checking:"
    echo "  $repo#$pr_number"
    echo "  $title"
    merged=$(gh api \
        "repos/$repo/pulls/$pr_number" \
        --jq '.merged')

    if [[ "$merged" != "true" ]]; then
        echo "  -> not merged, skipping"
        continue
    fi

    echo "  -> merged, clearing notification"

    gh api \
        -X PATCH \
        "notifications/threads/$thread_id" \
        >/dev/null

    gh api \
        -X DELETE \
        "notifications/threads/$thread_id" \
        >/dev/null

    echo "  -> done"

done

echo
echo "Finished."