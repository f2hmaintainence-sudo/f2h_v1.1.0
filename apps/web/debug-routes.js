// Debug script to check Next.js routes
const fs = require('fs');
const path = require('path');

const checkRoute = (routePath) => {
  const fullPath = path.join(__dirname, 'src/app', routePath);
  console.log(`\nChecking route: ${routePath}`);
  console.log(`Full path: ${fullPath}`);
  console.log(`Exists: ${fs.existsSync(fullPath)}`);

  if (fs.existsSync(fullPath)) {
    const files = fs.readdirSync(fullPath);
    console.log(`Files: ${files.join(', ')}`);

    const pageFile = path.join(fullPath, 'page.tsx');
    console.log(`page.tsx exists: ${fs.existsSync(pageFile)}`);
  }
};

console.log('=== Next.js Route Debug ===');

// Check the exact route structure
checkRoute('(panel)/admin/(CATALOG & INVENTORY)/catalog/products');
checkRoute('(panel)/admin/(CATALOG & INVENTORY)/catalog');
checkRoute('(panel)/admin');
checkRoute('(panel)');

console.log('\n=== Expected URL Structure ===');
console.log('Route: (panel)/admin/(CATALOG & INVENTORY)/catalog/products/page.tsx');
console.log('URL: http://localhost:3000/admin/catalog/products');
console.log('Note: Parentheses in route names are route groups and don\'t appear in URL');
