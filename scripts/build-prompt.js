const fs = require('fs');
const path = require('path');

const promptPath = path.join(__dirname, '..', 'src', 'assets', 'system-prompt.txt');
const outputPath = path.join(__dirname, '..', 'src', 'constants', 'prompt.ts');

const prompt = fs.readFileSync(promptPath, 'utf-8');

const content = `// Auto-generated at build time. Do not edit manually.
// Source: src/assets/system-prompt.txt

export const SYSTEM_PROMPT = ${JSON.stringify(prompt)};
`;

fs.writeFileSync(outputPath, content, 'utf-8');
console.log('System prompt built successfully');
