const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function generateDocumentPath(url) {
    const urlObj = new URL(url);
    let pathPart = urlObj.pathname.replace(/^\//, '').replace(/\.html$/, '');
    return `/workspace/content/${pathPart}.md`;
}

async function scrapeRecipe(page, url) {
    console.log(`\n  Navigating to ${url}...`);

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Close cookie dialog if present
        try {
            await page.getByRole('button', { name: 'OK' }).click({ timeout: 2000 });
        } catch (e) {
            // Ignore
        }

        // Wait for content to load
        await page.waitForTimeout(3000);

        // Extract recipe data
        const recipeData = await page.evaluate(() => {
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
                        data.nutrition.serving = servingEl.textContent.trim().replace(/\s+/g, ' ');
                    }

                    const nutritionItems = nutritionDiv.querySelectorAll('div > div');
                    const seenLabels = new Set();
                    nutritionItems.forEach(item => {
                        const labelEl = item.querySelector('div:first-child');
                        const valueEl = item.querySelector('div:last-child');
                        if (labelEl && valueEl) {
                            const label = labelEl.textContent.trim();
                            const value = valueEl.textContent.trim().replace(/"/g, '');
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
                while (nextEl && nextEl.tagName !== 'HR' && nextEl.tagName !== 'H2' && !nextEl.className.includes('recipe-footer')) {
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
        });

        return recipeData;
    } catch (error) {
        console.log(`    Error scraping: ${error.message}`);
        return null;
    }
}

function createMarkdown(data, url) {
    let md = `# ${data.title}\n\n`;
    md += `${data.description}\n\n`;
    md += `![${data.title}](${data.heroImage})\n\n`;
    md += `---\n\n`;

    // Ingredients
    md += `## Ingredients\n\n`;
    for (const ing of data.ingredients) {
        md += `- ${ing}\n`;
    }
    md += `\n`;

    // Directions
    md += `## Directions\n\n`;
    data.directions.forEach((direction, idx) => {
        md += `${idx + 1}. ${direction}\n\n`;
    });

    // Nutrition
    if (data.nutrition.items.length > 0) {
        md += `## Nutrition\n\n`;
        md += `**${data.nutrition.serving}**\n\n`;
        for (const item of data.nutrition.items) {
            md += `- ${item.label}: ${item.value}\n`;
        }
        md += `\n---\n\n`;
    }

    // Chef's Note
    if (data.chefsNote.length > 0) {
        md += `## Chef's Note\n\n`;
        for (const para of data.chefsNote) {
            md += `${para}\n\n`;
        }
        md += `---\n\n`;
    }

    // Metadata
    md += `| Metadata |  |\n`;
    md += `| --- | --- |\n`;
    md += `| source | ${url} |\n`;
    if (data.totalTime) {
        md += `| totalTime | ${data.totalTime} |\n`;
    }
    if (data.yield) {
        md += `| yield | ${data.yield} |\n`;
    }
    if (data.difficulty) {
        md += `| difficulty | ${data.difficulty} |\n`;
    }
    if (data.dietaryInterests.length > 0) {
        md += `| dietaryInterests | ${data.dietaryInterests.join(', ')} |\n`;
    }
    md += `\n`;

    return md;
}

async function main() {
    // Read URLs
    const urls = fs.readFileSync('/workspace/batch-15.txt', 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.startsWith('http'));

    console.log(`Processing ${urls.length} recipes...`);

    let successCount = 0;
    const failedUrls = [];

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`\n[${i + 1}/${urls.length}] Processing: ${url}`);

        const recipeData = await scrapeRecipe(page, url);

        if (recipeData && recipeData.title) {
            // Generate file path
            const filePath = generateDocumentPath(url);
            const dir = path.dirname(filePath);

            // Create directory if needed
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Create markdown
            const markdown = createMarkdown(recipeData, url);

            // Save file
            fs.writeFileSync(filePath, markdown, 'utf-8');

            console.log(`    ✓ Saved: ${filePath}`);
            console.log(`      Title: ${recipeData.title}`);
            console.log(`      Ingredients: ${recipeData.ingredients.length}`);
            console.log(`      Directions: ${recipeData.directions.length}`);
            successCount++;
        } else {
            console.log(`    ✗ Failed to extract recipe data`);
            failedUrls.push(url);
        }
    }

    await browser.close();

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Import Summary:`);
    console.log(`  Successfully imported: ${successCount}`);
    console.log(`  Failed: ${failedUrls.length}`);
    if (failedUrls.length > 0) {
        console.log(`\nFailed URLs:`);
        for (const url of failedUrls) {
            console.log(`    - ${url}`);
        }
    }
    console.log(`${'='.repeat(60)}\n`);

    return { successCount, failedUrls };
}

main().catch(console.error);
