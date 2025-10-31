#!/usr/bin/env python3
import json
import sys

def create_markdown_from_json(json_file, output_file):
    """Create markdown file from JSON recipe data"""
    
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    # Start markdown
    md = f"# {data['title']}\n\n"
    md += f"{data['description']}\n\n"
    md += f"![{data['title']}]({data['heroImageUrl']})\n\n"
    md += "---\n\n"
    
    # Ingredients
    md += "## Ingredients\n\n"
    for ing in data['ingredients']:
        md += f"- {ing}\n"
    md += "\n"
    
    # Directions
    md += "## Directions\n\n"
    for idx, direction in enumerate(data['directions'], 1):
        md += f"{idx}. {direction}\n\n"
    
    # Nutrition
    if 'nutrition' in data and data['nutrition'].get('items'):
        md += "## Nutrition\n\n"
        md += f"**{data['nutrition']['serving']}**\n\n"
        for item in data['nutrition']['items']:
            md += f"- {item}\n"
        md += "\n---\n\n"
    
    # Chef's Note (if present)
    if data.get('chefsNote'):
        md += "## Chef's Note\n\n"
        if isinstance(data['chefsNote'], list):
            for para in data['chefsNote']:
                md += f"{para}\n\n"
        else:
            md += f"{data['chefsNote']}\n\n"
        md += "---\n\n"
    
    # Metadata
    md += "| Metadata |  |\n"
    md += "| --- | --- |\n"
    md += f"| source | {data['url']} |\n"
    if data.get('totalTime'):
        md += f"| totalTime | {data['totalTime']} |\n"
    if data.get('yield'):
        md += f"| yield | {data['yield']} |\n"
    if data.get('difficulty'):
        md += f"| difficulty | {data['difficulty']} |\n"
    if data.get('dietaryInterests'):
        md += f"| dietaryInterests | {data['dietaryInterests']} |\n"
    md += "\n"
    
    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(md)
    
    print(f"Created: {output_file}")
    return True

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: create_recipe_md.py <input_json> <output_md>")
        sys.exit(1)
    
    create_markdown_from_json(sys.argv[1], sys.argv[2])
