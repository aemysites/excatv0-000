#!/bin/bash

# Read URLs from batch-6.txt
urls=(
  "https://www.vitamix.com/us/en_us/recipes/chestnut-soup"
  "https://www.vitamix.com/us/en_us/recipes/chicken-potato-spinach-soup"
  "https://www.vitamix.com/us/en_us/recipes/chicken-ramen"
  "https://www.vitamix.com/us/en_us/recipes/chocolate-almond-berry-smoothie"
  "https://www.vitamix.com/us/en_us/recipes/chocolate-avocado-nutella-smoothie"
  "https://www.vitamix.com/us/en_us/recipes/cinnamon-roll-smoothie"
  "https://www.vitamix.com/us/en_us/recipes/citrus-carrot-juice-immersion-blender"
  "https://www.vitamix.com/us/en_us/recipes/citrus-juice-reset"
  "https://www.vitamix.com/us/en_us/recipes/citrus-smoothie"
  "https://www.vitamix.com/us/en_us/recipes/coconut-fruit-smoothie"
)

echo "Processing ${#urls[@]} recipes..."

for url in "${urls[@]}"; do
  echo "URL: $url"
done
