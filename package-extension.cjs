#!/usr/bin/env node

/**
 * Chrome Extension Packaging Script
 * 
 * This script builds and packages the extension for Chrome Web Store submission.
 * It performs validation checks and creates a properly formatted zip file.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = './dist';
const PACKAGE_NAME = 'prompt-library-extension';

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  };
  
  const color = colors[type] || colors.info;
  console.log(`${color}${message}${colors.reset}`);
}

function checkPrerequisites() {
  log('🔍 Checking prerequisites...', 'info');
  
  // Check if Node.js and npm are available
  try {
    execSync('node --version', { stdio: 'ignore' });
    execSync('npm --version', { stdio: 'ignore' });
  } catch (error) {
    log(`❌ Node.js or npm not found. Please install Node.js. Error: ${error.message}`, 'error');
    process.exit(1);
  }
  
  // Check if package.json exists
  if (!fs.existsSync('./package.json')) {
    log('❌ package.json not found. Run this script from the project root.', 'error');
    process.exit(1);
  }
  
  // Check if manifest.json exists
  if (!fs.existsSync('./manifest.json')) {
    log('❌ manifest.json not found.', 'error');
    process.exit(1);
  }
  
  log('✅ Prerequisites check passed', 'success');
}

function validateManifest() {
  log('🔍 Validating manifest.json...', 'info');
  
  try {
    const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));
    
    // Check required fields
    const requiredFields = ['manifest_version', 'name', 'version', 'description'];
    const missingFields = requiredFields.filter(field => !manifest[field]);
    
    if (missingFields.length > 0) {
      log(`❌ Missing required manifest fields: ${missingFields.join(', ')}`, 'error');
      process.exit(1);
    }
    
    // Check manifest version
    if (manifest.manifest_version !== 3) {
      log('⚠️  Extension uses Manifest V2. Consider upgrading to V3.', 'warning');
    }
    
    // Check permissions
    if (manifest.permissions && manifest.permissions.length > 0) {
      log(`📋 Extension requests permissions: ${manifest.permissions.join(', ')}`, 'info');
    }
    
    log(`✅ Manifest validation passed (v${manifest.version})`, 'success');
    return manifest;
  } catch (error) {
    log(`❌ Invalid manifest.json: ${error.message}`, 'error');
    process.exit(1);
  }
}

function installDependencies() {
  log('📦 Installing dependencies...', 'info');
  
  try {
    execSync('npm install', { stdio: 'inherit' });
    log('✅ Dependencies installed successfully', 'success');
  } catch (error) {
    log(`❌ Failed to install dependencies: ${error.message}`, 'error');
    process.exit(1);
  }
}

function buildExtension() {
  log('🔨 Building extension...', 'info');
  
  // Clean previous build
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    log('🧹 Cleaned previous build', 'info');
  }
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    log('✅ Build completed successfully', 'success');
  } catch (error) {
    log(`❌ Build failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

function validateBuild() {
  log('🔍 Validating build output...', 'info');
  
  if (!fs.existsSync(DIST_DIR)) {
    log('❌ Build directory not found', 'error');
    process.exit(1);
  }
  
  // Check for required files
  const requiredFiles = [
    'manifest.json',
    'src/popup.html'
  ];
  
  const missingFiles = requiredFiles.filter(file => 
    !fs.existsSync(path.join(DIST_DIR, file))
  );
  
  if (missingFiles.length > 0) {
    log(`❌ Missing required files in build: ${missingFiles.join(', ')}`, 'error');
    process.exit(1);
  }
  
  // Check for icon files
  const iconSizes = [16, 32, 48, 128];
  const missingIcons = iconSizes.filter(size => {
    const iconPath = path.join(DIST_DIR, `public/icons/icon-${size}.png`);
    return !fs.existsSync(iconPath) || fs.statSync(iconPath).size === 0;
  });
  
  if (missingIcons.length > 0) {
    log(`⚠️  Missing or empty icon files: ${missingIcons.map(s => `icon-${s}.png`).join(', ')}`, 'warning');
    log('📝 Create proper icons before Chrome Web Store submission', 'warning');
  }
  
  log('✅ Build validation completed', 'success');
}

function createPackage(manifest) {
  log('📦 Creating extension package...', 'info');
  
  const version = manifest.version;
  const packageName = `${PACKAGE_NAME}-v${version}.zip`;
  
  try {
    // Create zip file
    execSync(`cd ${DIST_DIR} && zip -r ../${packageName} .`, { stdio: 'inherit' });
    
    const stats = fs.statSync(packageName);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    log(`✅ Package created: ${packageName} (${sizeMB} MB)`, 'success');
    return packageName;
  } catch (error) {
    log(`❌ Failed to create package: ${error.message}`, 'error');
    process.exit(1);
  }
}

function showSummary(packageName, manifest) {
  log('\n📋 PACKAGING SUMMARY', 'info');
  log('═'.repeat(50), 'info');
  log(`Extension Name: ${manifest.name}`, 'info');
  log(`Version: ${manifest.version}`, 'info');
  log(`Package File: ${packageName}`, 'info');
  log(`Manifest Version: ${manifest.manifest_version}`, 'info');
  log(`Permissions: ${manifest.permissions ? manifest.permissions.join(', ') : 'None'}`, 'info');
  
  log('\n📝 NEXT STEPS:', 'info');
  log('1. Review the generated package file', 'info');
  log('2. Test the extension by loading the unpacked dist/ folder in Chrome', 'info');
  log('3. Create proper icon files (see ICONS.md)', 'info');
  log('4. Review SUBMISSION.md for Chrome Web Store submission', 'info');
  log('5. Upload the zip file to Chrome Web Store Developer Dashboard', 'info');
  
  log('\n🚀 Ready for Chrome Web Store submission!', 'success');
}

function main() {
  try {
    log('🚀 Starting Chrome Extension Packaging Process\n', 'info');
    
    checkPrerequisites();
    const manifest = validateManifest();
    installDependencies();
    buildExtension();
    validateBuild();
    const packageName = createPackage(manifest);
    
    showSummary(packageName, manifest);
    
  } catch (error) {
    log(`❌ Packaging failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  checkPrerequisites,
  validateManifest,
  buildExtension,
  createPackage
};