#!/usr/bin/env bash
# Cheap pre-commit secret scanner. Greps staged files for a small set of
# obvious patterns — full-fat detection lives in CI via gitleaks. Tuned
# to be fast (few seconds) and to err on the side of letting commits
# through rather than blocking developers on false positives.

set -euo pipefail

# Skip on non-source files, lockfiles, and the .env.example documentation.
SCAN_PATTERNS='\.(ts|tsx|js|jsx|mjs|cjs|json|md|sh|env|yml|yaml|toml)$'
STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E "$SCAN_PATTERNS" || true)
[ -z "$STAGED" ] && exit 0

# Allowlist for files where placeholder-style strings are expected.
ALLOW='(^|/)(\.env\.example|README\.md|AGENTS\.md|CLAUDE\.md)$'

PATTERNS=(
  'sk_live_[A-Za-z0-9]{20,}'           # Stripe live secret
  'sk_test_[A-Za-z0-9]{20,}'           # Stripe test secret (also flagged)
  'rk_live_[A-Za-z0-9]{20,}'           # Stripe restricted key
  'AKIA[0-9A-Z]{16}'                   # AWS access key
  'AIza[0-9A-Za-z_-]{35}'              # Google API key
  'ghp_[A-Za-z0-9]{36,}'               # GitHub PAT
  'github_pat_[A-Za-z0-9_]{82,}'       # GitHub fine-grained PAT
  '-----BEGIN (RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----'
)

EXIT=0
while IFS= read -r f; do
  [ -e "$f" ] || continue
  echo "$f" | grep -qE "$ALLOW" && continue
  for p in "${PATTERNS[@]}"; do
    if grep -nE "$p" "$f" >/dev/null 2>&1; then
      echo "✗ Potential secret in $f matching /$p/" >&2
      EXIT=1
    fi
  done
done <<< "$STAGED"

if [ "$EXIT" -ne 0 ]; then
  echo "" >&2
  echo "Refusing to commit. If you're certain the match is a false positive," >&2
  echo "rephrase the literal or add the file to the allowlist in" >&2
  echo "scripts/scan-secrets.sh." >&2
fi
exit "$EXIT"
