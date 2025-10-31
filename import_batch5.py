#!/usr/bin/env python3
import asyncio
import json
import os
import re
from playwright.async_api import async_playwright
from urllib.parse import urlparse

def generate_document_path(url):
    """Generate EDS document path from URL"""
    parsed = urlparse(url)
    path = parsed.path.strip('/')
    path = re.sub(r'\.html$', '', path)
    return f"/workspace/content/{path}.md"

def clean_text(text):
    """Clean and normalize text"""
    if not text:
        return ''
    # Remove extra whitespace
    text = ' '.join(text.split())
    return text.strip()

def format_ingredient(parts):
    """Format ingredient from parts"""
    cleaned_parts = [clean_text(p) for p in parts if clean_text(p)]
    return ' '.join(cleaned_parts)

async def scrape_recipe(page, url):
    """Scrape a single recipe"""
    print(f"\n  Navigating to {url}...")
    
    try:
        await page.goto(url, wait_until='networkidle', timeout=30000)
        
        # Close cookie dialog if present
        try:
            await page.get_by_role('button', name='OK').click(timeout=2000)
        except:
            pass
        
        # Wait for content to load
        await page.wait_for_timeout(2000)
        
        # Extract recipe data using JavaScript
        recipe_data = await page.evaluate("""
            () => {
                const data = {
                    title: '',
                    description: '',
                    heroImage: '',
                    totalTime: '',
                    yield: '',
                    difficulty: '',
                    dietaryInterests: [],
                    ingredients: [],
                    directions: [],
                    nutrition: {
                        serving: '',
                        items: []
                    },
                    chefsNote: []
                };
                
                // Title
                const titleEl = document.querySelector('article h2');
                if (titleEl) data.title = titleEl.textContent.trim();
                
                // Description
                const descEl = document.querySelector('article > div > div > p');
                if (descEl) data.description = descEl.textContent.trim();
                
                // Hero image
                const imgEl = document.querySelector('article img');
                if (imgEl) data.heroImage = imgEl.src;
                
                // Metadata
                const metaItems = document.querySelectorAll('article > div > div > div > ul > li');
                metaItems.forEach(li => {
                    const text = li.textContent;
                    const valueEl = li.querySelector('div:last-child');
                    if (text.includes('Total Time') && valueEl) {
                        data.totalTime = valueEl.textContent.trim();
                    } else if (text.includes('Yield') && valueEl) {
                        data.yield = valueEl.textContent.trim();
                    } else if (text.includes('Difficulty') && valueEl) {
                        data.difficulty = valueEl.textContent.trim();
                    }
                });
                
                // Dietary interests
                const dietaryLinks = document.querySelectorAll('a[href*="refineby"]');
                const dietarySet = new Set();
                dietaryLinks.forEach(link => {
                    const text = link.textContent.trim().replace(',', '');
                    if (text && !text.includes('Manage')) {
                        dietarySet.add(text);
                    }
                });
                data.dietaryInterests = Array.from(dietarySet);
                
                // Ingredients
                const h2Elements = Array.from(document.querySelectorAll('h2'));
                const ingredientsH2 = h2Elements.find(h => h.textContent.includes('Ingredients'));
                if (ingredientsH2) {
                    const ul = ingredientsH2.nextElementSibling;
                    if (ul && ul.tagName === 'UL') {
                        const items = ul.querySelectorAll('li');
                        items.forEach(li => {
                            const divs = li.querySelectorAll('div > div');
                            const parts = Array.from(divs).map(d => d.textContent.trim()).filter(t => t);
                            if (parts.length > 0) {
                                data.ingredients.push(parts.join(' '));
                            }
                        });
                    }
                }
                
                // Directions
                const directionsH2 = h2Elements.find(h => h.textContent.includes('Directions'));
                if (directionsH2) {
                    const nextEl = directionsH2.nextElementSibling;
                    if (nextEl) {
                        // Handle both ul > li > ul > li and direct li structures
                        const dirItems = nextEl.querySelectorAll('li li');
                        if (dirItems.length > 0) {
                            dirItems.forEach(li => {
                                const text = li.textContent.trim();
                                if (text) data.directions.push(text);
                            });
                        } else {
                            const directItems = nextEl.querySelectorAll('li');
                            directItems.forEach(li => {
                                const text = li.textContent.trim();
                                if (text) data.directions.push(text);
                            });
                        }
                    }
                }
                
                // Nutrition
                const h3Elements = Array.from(document.querySelectorAll('h3'));
                const nutritionH3 = h3Elements.find(h => h.textContent.includes('Nutrition'));
                if (nutritionH3) {
                    const nutritionDiv = nutritionH3.nextElementSibling;
                    if (nutritionDiv) {
                        const servingEl = nutritionDiv.querySelector('div:first-child');
                        if (servingEl) {
                            data.nutrition.serving = servingEl.textContent.trim().replace(/\\s+/g, ' ');
                        }
                        
                        const nutritionItems = nutritionDiv.querySelectorAll('div > div');
                        const seenLabels = new Set();
                        nutritionItems.forEach(item => {
                            const labelEl = item.querySelector('div:first-child');
                            const valueEl = item.querySelector('div:last-child');
                            if (labelEl && valueEl) {
                                const label = labelEl.textContent.trim();
                                const value = valueEl.textContent.trim();
                                if (label && value && !seenLabels.has(label) && label !== data.nutrition.serving) {
                                    data.nutrition.items.push({ label, value });
                                    seenLabels.add(label);
                                }
                            }
                        });
                    }
                }
                
                // Chef's Note
                const chefsNoteH2 = h2Elements.find(h => h.textContent.includes("Chef's Note"));
                if (chefsNoteH2) {
                    let nextEl = chefsNoteH2.nextElementSibling;
                    while (nextEl && nextEl.tagName !== 'HR' && nextEl.tagName !== 'H2') {
                        if (nextEl.tagName === 'P') {
                            const text = nextEl.textContent.trim();
                            if (text) data.chefsNote.push(text);
                        } else if (nextEl.tagName === 'UL') {
                            const items = nextEl.querySelectorAll('li');
                            items.forEach(li => {
                                const text = li.textContent.trim();
                                if (text) data.chefsNote.push(text);
                            });
                        }
                        nextEl = nextEl.nextElementSibling;
                    }
                }
                
                return data;
            }
        """)
        
        return recipe_data
        
    except Exception as e:
        print(f"    Error scraping: {str(e)}")
        return None

def create_markdown(data, url):
    """Create markdown content from recipe data"""
    md = f"# {data['title']}\n\n"
    md += f"{data['description']}\n\n"
    md += f"![{data['title']}]({data['heroImage']})\n\n"
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
    if data['nutrition']['items']:
        md += "## Nutrition\n\n"
        md += f"**{data['nutrition']['serving']}**\n\n"
        for item in data['nutrition']['items']:
            md += f"- {item['label']}: {item['value']}\n"
        md += "\n---\n\n"
    
    # Chef's Note
    if data['chefsNote']:
        md += "## Chef's Note\n\n"
        for para in data['chefsNote']:
            md += f"{para}\n\n"
        md += "---\n\n"
    
    # Metadata
    md += "| Metadata |  |\n"
    md += "| --- | --- |\n"
    md += f"| source | {url} |\n"
    if data['totalTime']:
        md += f"| totalTime | {data['totalTime']} |\n"
    if data['yield']:
        md += f"| yield | {data['yield']} |\n"
    if data['difficulty']:
        md += f"| difficulty | {data['difficulty']} |\n"
    if data['dietaryInterests']:
        md += f"| dietaryInterests | {', '.join(data['dietaryInterests'])} |\n"
    md += "\n"
    
    return md

async def main():
    # Read URLs
    with open('/workspace/batch-5.txt', 'r') as f:
        urls = [line.strip() for line in f if line.strip() and line.strip().startswith('http')]
    
    print(f"Processing {len(urls)} recipes...")
    
    success_count = 0
    failed_urls = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        for idx, url in enumerate(urls, 1):
            print(f"\n[{idx}/{len(urls)}] Processing: {url}")
            
            recipe_data = await scrape_recipe(page, url)
            
            if recipe_data and recipe_data['title']:
                # Generate file path
                file_path = generate_document_path(url)
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                
                # Create markdown
                markdown = create_markdown(recipe_data, url)
                
                # Save file
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(markdown)
                
                print(f"    ✓ Saved: {file_path}")
                print(f"      Title: {recipe_data['title']}")
                print(f"      Ingredients: {len(recipe_data['ingredients'])}")
                print(f"      Directions: {len(recipe_data['directions'])}")
                success_count += 1
            else:
                print(f"    ✗ Failed to extract recipe data")
                failed_urls.append(url)
        
        await browser.close()
    
    # Summary
    print(f"\n{'='*60}")
    print(f"Import Summary:")
    print(f"  Successfully imported: {success_count}")
    print(f"  Failed: {len(failed_urls)}")
    if failed_urls:
        print(f"\nFailed URLs:")
        for url in failed_urls:
            print(f"    - {url}")
    print(f"{'='*60}\n")
    
    return success_count, failed_urls

if __name__ == '__main__':
    asyncio.run(main())
