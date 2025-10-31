const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Read URLs from batch-1.txt
const urls = fs.readFileSync('/workspace/batch-1.txt', 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && line.startsWith('http'));

console.log(`Found ${urls.length} URLs to process\n`);

// Function to generate document path
function generateDocPath(url) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  // Convert /us/en_us/recipes/acai-bowl to /us/en-us/recipes/acai-bowl
  const docPath = pathname.replace(/\/en_us\//g, '/en-us/');
  const mdPath = 'content' + docPath + '.md';
  return { docPath, mdPath };
}

// Function to create markdown
function createMarkdown(data) {
  let md = `# ${data.title}\n\n`;
  md += `${data.description}\n\n`;
  md += `![${data.title}](${data.imageUrl})\n\n`;
  md += `---\n\n`;

  // Ingredients
  md += `## Ingredients\n\n`;
  data.ingredients.forEach(ing => {
    md += `- ${ing}\n`;
  });
  md += `\n`;

  // Directions
  md += `## Directions\n\n`;
  data.directions.forEach((dir, idx) => {
    md += `${idx + 1}. ${dir}\n\n`;
  });

  // Nutrition
  if (data.nutrition && data.nutrition.items && data.nutrition.items.length > 0) {
    md += `## Nutrition\n\n`;
    md += `**${data.nutrition.serving}**\n\n`;
    data.nutrition.items.forEach(item => {
      md += `- ${item}\n`;
    });
    md += `\n---\n\n`;
  }

  // Chef's Note
  if (data.chefsNote && data.chefsNote.length > 0) {
    md += `## Chef's Note\n\n`;
    data.chefsNote.forEach(para => {
      md += `${para}\n\n`;
    });
    md += `---\n\n`;
  }

  // Metadata
  md += `| Metadata |  |\n`;
  md += `| --- | --- |\n`;
  md += `| source | ${data.sourceUrl} |\n`;
  if (data.totalTime) md += `| totalTime | ${data.totalTime} |\n`;
  if (data.yield) md += `| yield | ${data.yield} |\n`;
  if (data.difficulty) md += `| difficulty | ${data.difficulty} |\n`;
  if (data.dietaryInterests) md += `| dietaryInterests | ${data.dietaryInterests} |\n`;
  md += `\n`;

  return md;
}

// Main scraping function
async function scrapeRecipe(page, url) {
  try {
    console.log(`Scraping: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for ingredients to load
    await page.waitForTimeout(3000);

    // Extract data
    const data = await page.evaluate(() => {
      const result = {};

      // Title
      const titleEl = document.querySelector('article h2');
      result.title = titleEl ? titleEl.textContent.trim() : '';

      // Description
      const allPs = document.querySelectorAll('article p');
      for (const p of allPs) {
        const prev = p.previousElementSibling;
        if (prev && prev.tagName === 'DIV' && prev.previousElementSibling && prev.previousElementSibling.tagName === 'H2') {
          result.description = p.textContent.trim();
          break;
        }
      }

      // Image URL
      const imgEl = document.querySelector('article img[alt]');
      result.imageUrl = imgEl ? imgEl.src : '';

      // Total Time, Yield, Difficulty
      const metaItems = document.querySelectorAll('article ul > li');
      metaItems.forEach(li => {
        const divs = li.querySelectorAll('div');
        if (divs.length >= 2) {
          const label = divs[0].textContent.trim();
          const value = divs[1].textContent.trim();
          if (label === 'Total Time') result.totalTime = value;
          if (label === 'Yield') result.yield = value;
          if (label === 'Difficulty') result.difficulty = value;
        }
      });

      // Dietary Interests
      const diets = [];
      document.querySelectorAll('h4').forEach(h4 => {
        if (h4.textContent.includes('Dietary Interests')) {
          const parent = h4.parentElement;
          const links = parent.querySelectorAll('a[href*="refineby"]');
          links.forEach(a => {
            const text = a.textContent.replace(/,/g, '').trim();
            if (text) diets.push(text);
          });
        }
      });
      result.dietaryInterests = diets.join(', ');

      // Ingredients
      result.ingredients = [];
      document.querySelectorAll('h2').forEach(h2 => {
        if (h2.textContent.includes('Ingredients')) {
          const ul = h2.nextElementSibling;
          if (ul && ul.tagName === 'UL') {
            ul.querySelectorAll('li').forEach(li => {
              const divs = li.querySelectorAll('div');
              let text = '';
              divs.forEach(d => {
                const t = d.textContent.trim();
                if (t && !t.match(/^\(.*\)$/)) text += (text ? ' ' : '') + t;
              });
              text = text.trim().replace(/\s+/g, ' ');
              if (text) result.ingredients.push(text);
            });
          }
        }
      });

      // Directions
      result.directions = [];
      document.querySelectorAll('h2').forEach(h2 => {
        if (h2.textContent.includes('Directions')) {
          let el = h2.nextElementSibling;
          while (el) {
            if (el.tagName === 'A') {
              el = el.nextElementSibling;
              continue;
            }
            if (el.tagName === 'UL') {
              const items = el.querySelectorAll('li li, li > ul > li > ul > li');
              if (items.length === 0) {
                // Try direct li children
                el.querySelectorAll(':scope > li > ul > li').forEach(li => {
                  const text = li.textContent.trim();
                  if (text) result.directions.push(text);
                });
              } else {
                items.forEach(li => {
                  const text = li.textContent.trim();
                  if (text) result.directions.push(text);
                });
              }
              break;
            }
            el = el.nextElementSibling;
          }
        }
      });

      // Nutrition
      result.nutrition = { serving: '', items: [] };
      document.querySelectorAll('h3').forEach(h3 => {
        if (h3.textContent.includes('Nutrition')) {
          const container = h3.nextElementSibling;
          if (container) {
            const firstDiv = container.querySelector('div:first-child');
            if (firstDiv) result.nutrition.serving = firstDiv.textContent.trim();

            const pairs = container.querySelectorAll('div > div');
            for (let i = 0; i < pairs.length; i++) {
              const div = pairs[i];
              const children = div.querySelectorAll(':scope > div');
              if (children.length === 2) {
                const label = children[0].textContent.trim();
                const value = children[1].textContent.trim();
                if (label && value) {
                  result.nutrition.items.push(`${label}: ${value}`);
                }
              }
            }
          }
        }
      });

      // Chef's Note
      result.chefsNote = [];
      document.querySelectorAll('h2').forEach(h2 => {
        if (h2.textContent.includes("Chef's Note")) {
          let el = h2.nextElementSibling;
          while (el && el.tagName === 'P') {
            const text = el.textContent.trim();
            if (text) result.chefsNote.push(text);
            el = el.nextElementSibling;
          }
        }
      });

      result.sourceUrl = window.location.href;

      return result;
    });

    return { success: true, data };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main execution
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = { success: 0, failed: 0, errors: [] };

  for (const url of urls) {
    const result = await scrapeRecipe(page, url);

    if (result.success && result.data) {
      const { mdPath } = generateDocPath(url);
      const markdown = createMarkdown(result.data);

      // Ensure directory exists
      const dir = path.dirname(mdPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(mdPath, markdown, 'utf-8');
      console.log(`✓ Created: ${mdPath}`);
      results.success++;
    } else {
      console.log(`✗ Failed: ${url}`);
      results.failed++;
      results.errors.push({ url, error: result.error });
    }

    // Small delay between requests
    await page.waitForTimeout(1000);
  }

  await browser.close();

  console.log(`\n=== Summary ===`);
  console.log(`Successful: ${results.success}`);
  console.log(`Failed: ${results.failed}`);
  if (results.errors.length > 0) {
    console.log(`\nErrors:`);
    results.errors.forEach(e => console.log(`  - ${e.url}: ${e.error}`));
  }
})();
