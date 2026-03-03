echo "Checking what was reverted..."
git diff 922d51d18 --name-only | grep "ernos-*\|osint"
