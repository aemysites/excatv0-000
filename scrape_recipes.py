#!/usr/bin/env python3
import json
import re
import sys
from urllib.parse import urlparse

def generate_document_path(url):
    """Generate EDS document path from URL"""
    parsed = urlparse(url)
    path = parsed.path
    # Remove leading/trailing slashes
    path = path.strip('/')
    # Remove .html extension if present
    path = re.sub(r'\.html$', '', path)
    return f"/workspace/content/{path}"

def extract_recipe_slug(url):
    """Extract recipe slug from URL"""
    parsed = urlparse(url)
    parts = parsed.path.strip('/').split('/')
    return parts[-1] if parts else ''

# Read URLs from batch-5.txt
with open('/workspace/batch-5.txt', 'r') as f:
    urls = [line.strip() for line in f if line.strip() and line.strip().startswith('http')]

print(f"Found {len(urls)} URLs to process")
print(json.dumps(urls, indent=2))

# For each URL, show the document path
for url in urls:
    slug = extract_recipe_slug(url)
    doc_path = generate_document_path(url)
    md_path = f"{doc_path}.md"
    print(f"\n{url}")
    print(f"  Slug: {slug}")
    print(f"  MD Path: {md_path}")
