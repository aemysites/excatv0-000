#!/bin/bash

# Batch import script for Vitamix recipes
# Imports recipes in batches of 10 to avoid overwhelming the system

RECIPE_URLS_FILE="/workspace/recipe-urls.txt"
BATCH_SIZE=10
TOTAL_URLS=$(wc -l < "$RECIPE_URLS_FILE")
CURRENT_BATCH=1

echo "Starting import of $TOTAL_URLS recipes in batches of $BATCH_SIZE..."

# Read URLs and process in batches
while IFS= read -r url || [ -n "$url" ]; do
    echo "$url"
done < "$RECIPE_URLS_FILE" | while read -r batch_urls; do
    # Process each URL
    echo "Processing: $batch_urls"
done

echo "Import complete!"
