#!/usr/bin/env node

/**
 * Automated CSS to Tailwind Conversion Script
 *
 * Usage: node scripts/convert-component.js <component-name>
 * Example: node scripts/convert-component.js Editor
 *
 * This script converts a component from CSS to Tailwind classes:
 * 1. Reads the CSS file
 * 2. Reads the TSX file
 * 3. Applies class mappings based on css-to-tailwind-map.json
 * 4. Outputs modified TSX (does NOT modify files automatically)
 * 5. Generates a manual review checklist
 */

import fs from 'fs';
import path from 'path';

const COMPONENT_NAME = process.argv[2];

if (!COMPONENT_NAME) {
  console.error('❌ Error: Component name required');
  console.log('Usage: node scripts/convert-component.js <ComponentName>');
  console.log('Example: node scripts/convert-component.js Editor');
  process.exit(1);
}

// Load mapping file
const mappingPath = path.join(process.cwd(), 'scripts', 'css-to-tailwind-map.json');
let mapping;
try {
  mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  console.log('✓ Loaded CSS-to-Tailwind mapping');
} catch (err) {
  console.error('❌ Failed to load mapping file:', err.message);
  process.exit(1);
}

// Determine file paths based on component name
let cssPath, tsxPath;

if (COMPONENT_NAME === 'App') {
  cssPath = path.join(process.cwd(), 'src', 'App.css');
  tsxPath = path.join(process.cwd(), 'src', 'App.tsx');
} else {
  cssPath = path.join(process.cwd(), 'src', 'components', COMPONENT_NAME, `${COMPONENT_NAME}.css`);
  tsxPath = path.join(process.cwd(), 'src', 'components', COMPONENT_NAME, `${COMPONENT_NAME}.tsx`);
}

// Check if files exist
if (!fs.existsSync(cssPath)) {
  console.error(`❌ CSS file not found: ${cssPath}`);
  process.exit(1);
}
if (!fs.existsSync(tsxPath)) {
  console.error(`❌ TSX file not found: ${tsxPath}`);
  process.exit(1);
}

console.log(`✓ Found CSS: ${cssPath}`);
console.log(`✓ Found TSX: ${tsxPath}`);

// Read files
const cssContent = fs.readFileSync(cssPath, 'utf8');
const tsxContent = fs.readFileSync(tsxPath, 'utf8');

// Extract CSS class names
const cssClassRegex = /\.([a-zA-Z0-9_-]+)\s*\{/g;
const cssClasses = [...cssContent.matchAll(cssClassRegex)].map(m => m[1]);
const uniqueClasses = [...new Set(cssClasses)];

console.log(`\n📋 Found ${uniqueClasses.length} CSS classes:`);
uniqueClasses.forEach(cls => console.log(`   - .${cls}`));

// Generate conversion report
console.log(`\n=================================================`);
console.log(`CONVERSION REPORT: ${COMPONENT_NAME}`);
console.log(`=================================================\n`);

console.log(`📁 Files:`);
console.log(`   CSS: ${cssPath}`);
console.log(`   TSX: ${tsxPath}`);
console.log(`   Total CSS lines: ${cssContent.split('\n').length}`);
console.log(`   Total TSX lines: ${tsxContent.split('\n').length}\n`);

console.log(`🎨 CSS Classes to Convert:`);
uniqueClasses.forEach(cls => {
  const usageCount = (tsxContent.match(new RegExp(`className.*${cls}`, 'g')) || []).length;
  console.log(`   .${cls} → Used ${usageCount} times in TSX`);
});

console.log(`\n🚨 MANUAL CONVERSION REQUIRED:`);
console.log(`   This script provides analysis only.`);
console.log(`   Use the PRD (Section: File-by-File Conversion Details)`);
console.log(`   to manually apply Tailwind classes.\n`);

console.log(`✅ Next Steps:`);
console.log(`   1. Open the PRD conversion section for ${COMPONENT_NAME}`);
console.log(`   2. Find each CSS class usage in ${COMPONENT_NAME}.tsx`);
console.log(`   3. Replace with corresponding Tailwind classes`);
console.log(`   4. Remove CSS import from component`);
console.log(`   5. Delete ${COMPONENT_NAME}.css`);
console.log(`   6. Test component renders identically\n`);

console.log(`📝 Manual Review Checklist:`);
console.log(`   [ ] All className attributes updated`);
console.log(`   [ ] Removed: import './${COMPONENT_NAME}.css'`);
console.log(`   [ ] Hover states converted (hover:)`);
console.log(`   [ ] Focus states converted (focus:)`);
console.log(`   [ ] Active states converted (active:)`);
console.log(`   [ ] Component renders identically`);
console.log(`   [ ] No console errors`);
console.log(`   [ ] Deleted: ${COMPONENT_NAME}.css\n`);

console.log(`=================================================\n`);

