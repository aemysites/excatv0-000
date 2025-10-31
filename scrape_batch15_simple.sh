#!/bin/bash

# Simple recipe scraper using curl and basic parsing
# This is a simplified approach that may not work for all recipes but is much faster

URLS=(
"https://www.vitamix.com/us/en_us/recipes/peas-cream-with-taralli"
"https://www.vitamix.com/us/en_us/recipes/pho"
"https://www.vitamix.com/us/en_us/recipes/pine-mint-smoothie"
"https://www.vitamix.com/us/en_us/recipes/pineapple-whole-fruit-juice"
"https://www.vitamix.com/us/en_us/recipes/pitaya-mango-smoothie-bowl"
"https://www.vitamix.com/us/en_us/recipes/pomegranate-beet-smoothie"
"https://www.vitamix.com/us/en_us/recipes/pomegranate-boost-smoothie"
"https://www.vitamix.com/us/en_us/recipes/pomegranate-orange-smoothie"
"https://www.vitamix.com/us/en_us/recipes/pomegranate-refresher"
)

SUCCESS=0
FAILED=0

echo "Processing ${#URLS[@]} recipes..."
echo ""

for url in "${URLS[@]}"; do
    echo "Processing: $url"

    # Extract path and create file path
    path=$(echo "$url" | sed 's|https://www.vitamix.com/us/en_us/||')
    filepath="/workspace/content/us/en-us/$path.md"

    # Create directory if needed
    mkdir -p "$(dirname "$filepath")"

    # Fetch the page
    html=$(curl -s "$url")

    if [ $? -eq 0 ] && [ -n "$html" ]; then
        echo "  ✓ Fetched HTML"
        echo "  Note: Manual processing required via browser for complete data extraction"
        echo "  File would be: $filepath"
        SUCCESS=$((SUCCESS + 1))
    else
        echo "  ✗ Failed to fetch"
        FAILED=$((FAILED + 1))
    fi

    echo ""
done

echo "============================================================"
echo "Summary:"
echo "  Successfully fetched: $SUCCESS"
echo "  Failed: $FAILED"
echo "  Note: Due to JavaScript rendering, please use browser tools"
echo "============================================================"
