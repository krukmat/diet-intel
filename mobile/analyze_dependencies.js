const fs = require('fs');
const path = require('path');

function findImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const importRegex = /^import.*from\s+['"]([^'"]+)['"]/gm;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      // Only relative imports starting with ./
      if (importPath.startsWith('./')) {
        imports.push(importPath);
      }
    }
    
    return imports;
  } catch (error) {
    return [];
  }
}

function resolveImport(basePath, importPath) {
  const fullPath = path.resolve(basePath, importPath);
  
  // Try .tsx first, then .ts
  const tsxPath = fullPath + '.tsx';
  const tsPath = fullPath + '.ts';
  const indexTsxPath = path.join(fullPath, 'index.tsx');
  const indexTsPath = path.join(fullPath, 'index.ts');
  
  if (fs.existsSync(tsxPath)) return tsxPath;
  if (fs.existsSync(tsPath)) return tsPath;
  if (fs.existsSync(indexTsxPath)) return indexTsxPath;
  if (fs.existsSync(indexTsPath)) return indexTsPath;
  
  return null;
}

function analyzeDependencies(entryPoint) {
  const visited = new Set();
  const toVisit = [entryPoint];
  const allFiles = new Set();
  
  while (toVisit.length > 0) {
    const currentFile = toVisit.pop();
    
    if (visited.has(currentFile)) continue;
    visited.add(currentFile);
    allFiles.add(currentFile);
    
    const imports = findImports(currentFile);
    const basePath = path.dirname(currentFile);
    
    for (const importPath of imports) {
      const resolvedPath = resolveImport(basePath, importPath);
      if (resolvedPath && !visited.has(resolvedPath) && !toVisit.includes(resolvedPath)) {
        // Skip test files and node_modules
        if (!resolvedPath.includes('__tests__') && !resolvedPath.includes('node_modules')) {
          toVisit.push(resolvedPath);
        }
      }
    }
  }
  
  return Array.from(allFiles);
}

// Analyze from App.tsx
const dependencies = analyzeDependencies('./App.tsx');
console.log(JSON.stringify(dependencies, null, 2));
