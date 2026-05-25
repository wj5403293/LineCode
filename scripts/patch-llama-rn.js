const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'llama.rn',
  'android',
  'build.gradle',
);

if (!fs.existsSync(buildGradlePath)) {
  process.exit(0);
}

const original = fs.readFileSync(buildGradlePath, 'utf8');

const oldBlock = `    if (hexagonPresent) {
      println("✅ Hexagon SDK detected — enabling DSP build")
      cmakeArgs += [
        "-DHEXAGON_SDK_ROOT=\${hexagonSdkRoot}",
        "-DHEXAGON_TOOLS_ROOT=\${hexagonToolsRoot}"
      ]
    } else {
      println("🚫 Hexagon SDK not found — building CPU-only")
    }`;

const newBlock = `    if (hexagonPresent) {
      println("llama.rn: Hexagon SDK detected - enabling DSP source build")
      cmakeArgs += [
        "-DHEXAGON_SDK_ROOT=\${hexagonSdkRoot}",
        "-DHEXAGON_TOOLS_ROOT=\${hexagonToolsRoot}"
      ]
    } else if (isRNLlamaBuildFromSource) {
      println("llama.rn: Hexagon SDK not found - source build will be CPU/OpenCL-only")
    } else {
      println("llama.rn: using prebuilt native libraries; Hexagon SDK is only required for rnllamaBuildFromSource=true")
    }`;

if (original.includes(newBlock)) {
  process.exit(0);
}

if (!original.includes(oldBlock)) {
  console.warn('patch-llama-rn: expected build.gradle block was not found');
  process.exit(0);
}

fs.writeFileSync(buildGradlePath, original.replace(oldBlock, newBlock));
console.log('patch-llama-rn: patched llama.rn Android Gradle message');
