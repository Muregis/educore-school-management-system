const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');
const files = {};

function scan(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      scan(fullPath);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const imports = [];
      const regex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        imports.push(match[1]);
      }
      files[path.relative(srcDir, fullPath)] = imports;
    }
  }
}

scan(srcDir);

function findCircular() {
  const visited = new Set();
  const pathSet = new Set();
  
  function dfs(node, pathArr) {
    if (pathSet.has(node)) {
      const cycleStart = pathArr.indexOf(node);
      console.log('CIRCULAR:', pathArr.slice(cycleStart).join(' -> ') + ' -> ' + node);
      return true;
    }
    if (visited.has(node)) return false;
    
    visited.add(node);
    pathSet.add(node);
    pathArr.push(node);
    
    const deps = files[node] || [];
    for (const dep of deps) {
      let depPath = dep;
      if (dep.startsWith('.')) {
        const dir = path.dirname(node);
        depPath = path.join(dir, dep);
        depPath = path.relative(srcDir, depPath);
        if (!depPath.endsWith('.js') && !depPath.endsWith('.jsx')) {
          depPath += '.js';
        }
      }
      if (files[depPath]) {
        dfs(depPath, [...pathArr]);
      }
    }
    
    pathSet.delete(node);
    return false;
  }
  
  for (const file of Object.keys(files)) {
    visited.clear();
    pathSet.clear();
    dfs(file, []);
  }
}

findCircular();
