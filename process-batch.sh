#!/bin/bash

# List of URLs
urls=(
  "https://www.vitamix.com/us/en_us/recipes/acai-bowl"
  "https://www.vitamix.com/us/en_us/recipes/acai-bowl--mini-chopper-attachment-immersion-blender"
  "https://www.vitamix.com/us/en_us/recipes/acorn-squash-and-turmeric-soup"
  "https://www.vitamix.com/us/en_us/recipes/acorn-squash-soup"
  "https://www.vitamix.com/us/en_us/recipes/aerogarden-cucumber-mint-lemonade"
  "https://www.vitamix.com/us/en_us/recipes/alans-going-green-smoothie"
  "https://www.vitamix.com/us/en_us/recipes/all-green-smoothie-bowl"
  "https://www.vitamix.com/us/en_us/recipes/almond-yogurt-peach-and-banana-smoothie"
  "https://www.vitamix.com/us/en_us/recipes/almond-yogurt-peach-and-banana-smoothie-immersion-blender"
  "https://www.vitamix.com/us/en_us/recipes/apple-acorn-squash-soup"
)

echo "Processing ${#urls[@]} recipes..."

for url in "${urls[@]}"; do
  echo "URL: $url"
done
