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
let next = original;

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

if (!next.includes(newBlock)) {
  if (!next.includes(oldBlock)) {
    console.warn('patch-llama-rn: expected build.gradle message block was not found');
  } else {
    next = next.replace(oldBlock, newBlock);
  }
}

const oldAssetsRoot = 'def assetsRootDir = new File(applicationProject.projectDir, "src/main/assets")';
const newAssetsRoot = 'def assetsRootDir = new File(applicationProject.projectDir, "src/local/assets")';

if (!next.includes(newAssetsRoot)) {
  if (!next.includes(oldAssetsRoot)) {
    console.warn('patch-llama-rn: expected HTP assets root was not found');
  } else {
    next = next.replace(oldAssetsRoot, newAssetsRoot);
  }
}

if (next !== original) {
  fs.writeFileSync(buildGradlePath, next);
  console.log('patch-llama-rn: patched llama.rn Android Gradle configuration');
}
