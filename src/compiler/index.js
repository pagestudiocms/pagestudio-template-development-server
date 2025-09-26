/**
 * Template Compiler
 * Main module that coordinates template compilation process
 */

const path = require('path');
const fs = require('fs');
const { Parser } = require('./parser');
const { PluginSystem } = require('./plugin-system');
const { setupWatcher } = require('./watcher');
const { 
  loadPartials, 
  loadTemplateData, 
  saveProcessedTemplate,
  findTemplateFiles
} = require('./file-utils');

class TemplateCompiler {
  /**
   * Create a new TemplateCompiler
   * @param {object} options - Compiler options
   * @param {string} options.src - Source directory
   * @param {string} options.dest - Output directory
   * @param {string} options.partials - Partials directory
   * @param {string} options.dataSrc - Data files directory
   */
  constructor(options) {
    this.options = {
      src: options.src || 'src',
      dest: options.dest || 'compiled',
      partials: options.partials || 'src/partials',
      dataSrc: options['data-src'] || 'src/html/data'
    };
    
    // Initialize components
    this.parser = new Parser();
    this.pluginSystem = new PluginSystem(this.parser);
    
    // Load shared resources
    this.partials = loadPartials(this.options.partials);
  }

  /**
   * Register all template plugins
   */
  registerPlugins() {
    const pluginsDir = path.join(process.cwd(), 'src', 'plugins');
    this.pluginSystem.registerPlugins(pluginsDir);
  }

  /**
   * Compile a single template file
   * @param {string} filePath - Path to template file
   */
  compileFile(filePath) {
    // Read the template file
    const layoutContent = fs.readFileSync(filePath, 'utf-8');
    const layoutName = path.basename(filePath, '.html');
    
    // Load the data for this template
    const context = loadTemplateData(layoutName, this.options.dataSrc);
    
    // Process the template
    const processedContent = this.parser.processTemplate(
      layoutContent, 
      context, 
      this.partials
    );
    
    // Save the processed template
    saveProcessedTemplate(processedContent, filePath, {
      src: this.options.src,
      dest: this.options.dest
    });
  }

  /**
   * Start the template compilation process
   * @returns {Promise<void>}
   */
  async compile() {
    try {
      // Register plugin callbacks
      this.registerPlugins();
      
      // Find all template files
      const files = await findTemplateFiles(this.options.src);
      
      // Process each template file
      for (const filePath of files) {
        this.compileFile(filePath);
      }
    
      return Promise.resolve();
    } catch (error) {
      console.error('Error compiling templates:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Watch for file changes and recompile templates
   * @returns {object} - The watcher instance
   */
  watch() {
    return setupWatcher({
      src: this.options.src,
      onFileChange: (filePath) => {
        // Reload partials in case they changed
        this.partials = loadPartials(this.options.partials);
        this.compileFile(filePath);
      }
    });
  }
}

module.exports = { TemplateCompiler };