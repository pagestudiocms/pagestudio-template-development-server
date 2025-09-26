/**
 * File System Utilities
 * Handles file loading and saving operations
 */

const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const glob = require('glob');

/**
 * Load partial templates from a directory
 * @param {string} partialsDir - Directory containing partial templates
 * @returns {object} - Object with partial name as key and content as value
 */
const loadPartials = (partialsDir) => {
  const partials = {};
  if (fs.existsSync(partialsDir)) {
    const partialFiles = glob.sync(path.join(partialsDir, '*.html'));
    partialFiles.forEach((filePath) => {
      const partialName = path.basename(filePath, '.html');
      partials[partialName] = fs.readFileSync(filePath, 'utf-8');
    });
  } else {
    console.error(`Partials directory "${partialsDir}" not found.`);
  }
  return partials;
};

/**
 * Load template data file
 * @param {string} layoutName - The name of the layout file
 * @param {string} dataDir - Directory containing data files
 * @returns {object} - The template data object
 */
const loadTemplateData = (layoutName, dataDir) => {
  const dataFilePath = path.join(dataDir, `${layoutName}.data.json`);
  
  // Load the context for the current layout if available
  let context = {};
  if (fs.existsSync(dataFilePath)) {
    context = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
  } else {
    console.log(`No data found for "${layoutName}". Using default context.`);
  }
  
  return context;
};

/**
 * Save processed template to output directory
 * @param {string} content - Processed template content
 * @param {string} filePath - Original file path
 * @param {object} options - Options including src and dest directories
 */
const saveProcessedTemplate = (content, filePath, options) => {
  const { src, dest } = options;
  
  // Define the output path for the compiled layout in the compiled folder
  const relativeFilePath = path.relative(src, filePath); // Remove the "src" folder part
  const distFilePath = path.join(dest, relativeFilePath);

  // Remove 'layouts' from the file path (we don't want the "layouts" folder in compiled)
  const distFilePathWithoutLayouts = distFilePath.replace(/layouts\//, '');

  // Create the necessary directories in the compiled folder
  fse.ensureDirSync(path.dirname(distFilePathWithoutLayouts));

  // Save the processed layout file to the compiled directory
  fse.outputFileSync(distFilePathWithoutLayouts, content);
  console.log(`Processed and saved: ${distFilePathWithoutLayouts}`);
};

/**
 * Find all template files in a directory
 * @param {string} srcDir - Source directory
 * @param {string} globPattern - Pattern to match files
 * @returns {Promise<string[]>} - Array of matching file paths
 */
const findTemplateFiles = (srcDir, globPattern = '**/*.html') => {
  return new Promise((resolve, reject) => {
    const pattern = path.join(srcDir, 'layouts', globPattern);
    glob(pattern, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(files);
    });
  });
};

module.exports = {
  loadPartials,
  loadTemplateData,
  saveProcessedTemplate,
  findTemplateFiles
};