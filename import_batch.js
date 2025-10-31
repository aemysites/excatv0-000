#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Read URLs from batch file
const batchFile = process.argv[2] || '/workspace/batch-6.txt';
const urls = fs.readFileSync(batchFile, 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && line.startsWith('http'));

console.log(`Found ${urls.length} URLs to process`);

// Function to generate EDS document path from URL
function generateDocumentPath(url) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  // Extract the recipe slug from the URL
  const parts = pathname.split('/').filter(p => p);
  const slug = parts[parts.length - 1];

  return {
    slug,
    mdPath: `/workspace/content/us/en-us/recipes/${slug}.md`,
    htmlPath: `/workspace/content/us/en-us/recipes/${slug}.html`
  };
}

// Function to format nutrition as markdown list
function formatNutrition(nutrition) {
  if (!nutrition || Object.keys(nutrition).length === 0) return '';

  const lines = [];
  if (nutrition.serving) {
    lines.push(`**${nutrition.serving}**`);
    lines.push('');
  }

  for (const [key, value] of Object.entries(nutrition)) {
    if (key !== 'serving') {
      lines.push(`- ${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

// Function to create markdown content
function createMarkdown(data, sourceUrl) {
  const lines = [];

  // Title
  lines.push(`# ${data.title}`);
  lines.push('');

  // Description
  if (data.description) {
    lines.push(data.description);
    lines.push('');
  }

  // Hero image
  if (data.heroImage) {
    lines.push(`![${data.title}](${data.heroImage})`);
    lines.push('');
  }

  // Horizontal rule
  lines.push('---');
  lines.push('');

  // Ingredients
  if (data.ingredients && data.ingredients.length > 0) {
    lines.push('## Ingredients');
    lines.push('');
    data.ingredients.forEach(ingredient => {
      // Check if it's a section header (starts with quotes or "For the")
      if (ingredient.startsWith('"') || ingredient.startsWith('For the')) {
        lines.push('');
        lines.push(`**${ingredient.replace(/"/g, '')}**`);
        lines.push('');
      } else {
        lines.push(`- ${ingredient}`);
      }
    });
    lines.push('');
  }

  // Directions
  if (data.directions && data.directions.length > 0) {
    lines.push('## Directions');
    lines.push('');
    data.directions.forEach((direction, index) => {
      lines.push(`${index + 1}. ${direction}`);
      lines.push('');
    });
  }

  // Nutrition
  if (data.nutrition && Object.keys(data.nutrition).length > 1) {
    lines.push('## Nutrition');
    lines.push('');
    lines.push(formatNutrition(data.nutrition));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Chef's Note
  if (data.chefsNote) {
    lines.push("## Chef's Note");
    lines.push('');
    lines.push(data.chefsNote);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Metadata table
  lines.push('| Metadata |  |');
  lines.push('| --- | --- |');
  lines.push(`| source | ${sourceUrl} |`);
  if (data.metadata.totalTime) {
    lines.push(`| totalTime | ${data.metadata.totalTime} |`);
  }
  if (data.metadata.yield) {
    lines.push(`| yield | ${data.metadata.yield} |`);
  }
  if (data.metadata.difficulty) {
    lines.push(`| difficulty | ${data.metadata.difficulty} |`);
  }
  if (data.metadata.dietaryInterests) {
    lines.push(`| dietaryInterests | ${data.metadata.dietaryInterests} |`);
  }
  lines.push('');

  return lines.join('\n');
}

// Main function to scrape and save recipe
async function processRecipe(page, url) {
  try {
    console.log(`\nProcessing: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Accept cookies if dialog appears
    try {
      await page.click('button:has-text("OK")', { timeout: 2000 });
    } catch (e) {
      // No cookie dialog, continue
    }

    // Wait for content to load
    await page.waitForSelector('article h2', { timeout: 10000 });
    await page.waitForTimeout(3000); // Wait for ingredients to load

    // Extract recipe data
    const recipeData = await page.evaluate(() => {
      const result = {
        title: '',
        description: '',
        heroImage: '',
        ingredients: [],
        directions: [],
        nutrition: {},
        chefsNote: '',
        metadata: {
          totalTime: '',
          yield: '',
          difficulty: '',
          dietaryInterests: ''
        }
      };

      // Get title
      const titleElement = document.querySelector('article h2');
      if (titleElement) result.title = titleElement.textContent.trim();

      // Get description
      const article = document.querySelector('article');
      if (article) {
        const paragraphs = article.querySelectorAll('p');
        for (const p of paragraphs) {
          const text = p.textContent.trim();
          if (text && !text.includes('Free Standard') && text.length > 20) {
            result.description = text;
            break;
          }
        }
      }

      // Get hero image
      const heroImg = document.querySelector('article img[alt]');
      if (heroImg && heroImg.alt && !heroImg.alt.includes('Image of')) {
        result.heroImage = heroImg.src;
      }

      // Get metadata
      const metaItems = document.querySelectorAll('article ul li');
      metaItems.forEach(item => {
        const divs = item.querySelectorAll(':scope > div');
        if (divs.length === 2) {
          const label = divs[0].textContent.trim();
          const value = divs[1].textContent.trim();
          if (label === 'Total Time') result.metadata.totalTime = value;
          if (label === 'Yield') result.metadata.yield = value;
          if (label === 'Difficulty') result.metadata.difficulty = value;
        }
      });

      // Get dietary interests
      const dietaryLinks = document.querySelectorAll('a[href*="refineby"]');
      const dietary = [];
      dietaryLinks.forEach(link => {
        const text = link.textContent.trim().replace(',', '');
        if (text && !dietary.includes(text)) dietary.push(text);
      });
      result.metadata.dietaryInterests = dietary.join(', ');

      // Get ingredients
      const allHeadings = Array.from(document.querySelectorAll('h2'));
      const ingredientsHeading = allHeadings.find(h => h.textContent.trim() === 'Ingredients');
      if (ingredientsHeading) {
        const parent = ingredientsHeading.parentElement;
        const ingredientsList = parent.querySelector('ul');
        if (ingredientsList) {
          const items = ingredientsList.querySelectorAll(':scope > li');
          items.forEach(li => {
            const divs = li.querySelectorAll(':scope > div');
            if (divs.length === 1) {
              result.ingredients.push(divs[0].textContent.trim());
            } else if (divs.length > 1) {
              const parts = [];
              divs.forEach(div => {
                const text = div.textContent.trim();
                if (text) parts.push(text);
              });
              result.ingredients.push(parts.join(' '));
            }
          });
        }
      }

      // Get directions
      const directionsHeading = allHeadings.find(h => h.textContent.trim() === 'Directions');
      if (directionsHeading) {
        const parent = directionsHeading.parentElement;
        const directionsList = parent.querySelector('ol');
        if (directionsList) {
          const topItems = directionsList.querySelectorAll(':scope > li');
          topItems.forEach(topLi => {
            const nestedList = topLi.querySelector('ul');
            if (nestedList) {
              const steps = nestedList.querySelectorAll('li');
              steps.forEach(step => {
                const text = step.textContent.trim();
                if (text) result.directions.push(text);
              });
            }
          });
        }
      }

      // Get nutrition
      const allH3 = Array.from(document.querySelectorAll('h3'));
      const nutritionHeading = allH3.find(h => h.textContent.trim() === 'Nutrition');
      if (nutritionHeading) {
        const nutritionSection = nutritionHeading.nextElementSibling;
        if (nutritionSection) {
          const firstDiv = nutritionSection.querySelector(':scope > div:first-child');
          if (firstDiv) result.nutrition.serving = firstDiv.textContent.trim();

          const nutrientDivs = nutritionSection.querySelectorAll(':scope > div:not(:first-child)');
          nutrientDivs.forEach(div => {
            const children = div.querySelectorAll(':scope > div');
            if (children.length === 2) {
              const label = children[0].textContent.trim();
              const value = children[1].textContent.trim().replace(/"/g, '');
              result.nutrition[label] = value;
            }
          });
        }
      }

      // Get chef's note
      const chefNoteHeading = allHeadings.find(h => h.textContent.includes("Chef's Note"));
      if (chefNoteHeading) {
        const noteList = chefNoteHeading.nextElementSibling;
        if (noteList && noteList.tagName === 'UL') {
          const items = noteList.querySelectorAll('li');
          const notes = [];
          items.forEach(li => notes.push(li.textContent.trim()));
          result.chefsNote = notes.join('\n\n');
        }
      }

      return result;
    });

    if (!recipeData.title) {
      console.error(`  ❌ Failed to extract recipe title from ${url}`);
      return { success: false, url, error: 'No title found' };
    }

    // Generate document paths
    const paths = generateDocumentPath(url);

    // Create markdown content
    const markdown = createMarkdown(recipeData, url);

    // Ensure directory exists
    const dir = path.dirname(paths.mdPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save markdown file
    fs.writeFileSync(paths.mdPath, markdown, 'utf-8');
    console.log(`  ✓ Saved: ${paths.mdPath}`);

    return { success: true, url, path: paths.mdPath, title: recipeData.title };

  } catch (error) {
    console.error(`  ❌ Error processing ${url}:`, error.message);
    return { success: false, url, error: error.message };
  }
}

// Main execution
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  for (const url of urls) {
    const result = await processRecipe(page, url);
    results.push(result);

    // Small delay between requests
    await page.waitForTimeout(1000);
  }

  await browser.close();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✓ Successfully imported: ${successful.length} recipes`);
  successful.forEach(r => {
    console.log(`  - ${r.title}`);
  });

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length} recipes`);
    failed.forEach(r => {
      console.log(`  - ${r.url}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  process.exit(failed.length > 0 ? 1 : 0);
})();
