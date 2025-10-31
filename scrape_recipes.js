// Recipe scraper for Vitamix recipes
// This script extracts all recipe data from a Vitamix recipe page

async function scrapeRecipe(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for content to load
    await page.waitForSelector('article h2', { timeout: 10000 });

    // Extract all recipe data
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
        const firstDiv = article.querySelector('div');
        if (firstDiv) {
          const firstChild = firstDiv.querySelector('div');
          if (firstChild) {
            const pElement = firstChild.querySelector('p');
            if (pElement) result.description = pElement.textContent.trim();
          }
        }
      }

      // Get hero image
      const heroImg = document.querySelector('article img[alt]');
      if (heroImg && heroImg.alt) result.heroImage = heroImg.src;

      // Get metadata from the top section
      const metaItems = document.querySelectorAll('article ul li');
      metaItems.forEach(item => {
        const divs = item.querySelectorAll('div');
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
          const items = ingredientsList.querySelectorAll('li');
          items.forEach(li => {
            // Check if this is a section header or ingredient
            const divs = li.querySelectorAll('div');
            if (divs.length === 1) {
              // Section header
              result.ingredients.push(divs[0].textContent.trim());
            } else if (divs.length > 1) {
              // Ingredient with quantity
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
            } else {
              const text = topLi.textContent.trim();
              if (text) result.directions.push(text);
            }
          });
        }
      }

      // Get nutrition info
      const allH3 = Array.from(document.querySelectorAll('h3'));
      const nutritionHeading = allH3.find(h => h.textContent.trim() === 'Nutrition');
      if (nutritionHeading) {
        const nutritionSection = nutritionHeading.nextElementSibling;
        if (nutritionSection) {
          const allDivs = nutritionSection.querySelectorAll('div');
          let serving = '';
          const nutritionData = {};

          allDivs.forEach(div => {
            const children = div.querySelectorAll(':scope > div');
            if (children.length === 2) {
              const label = children[0].textContent.trim();
              const value = children[1].textContent.trim().replace(/"/g, '');
              nutritionData[label] = value;
            } else if (children.length === 0 && div.textContent.includes('serving')) {
              serving = div.textContent.trim();
            }
          });

          result.nutrition = { serving, ...nutritionData };
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

    return recipeData;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return null;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrapeRecipe };
}
