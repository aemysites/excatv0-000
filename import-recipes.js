const fs = require('fs');
const path = require('path');

// Read URLs from batch-1.txt
const urls = fs.readFileSync('/workspace/batch-1.txt', 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && line.startsWith('http'));

console.log(`Found ${urls.length} URLs to process`);

// Recipe data extracted from page (to be filled manually from browser scraping)
const recipes = {};

// Helper to create markdown from recipe data
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
  if (data.nutrition && data.nutrition.length > 0) {
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

// Export for use
module.exports = { urls, createMarkdown, recipes };

console.log('Script loaded. URLs ready for processing.');
