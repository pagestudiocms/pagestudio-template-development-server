/**
 * Plugin System Module
 * Handles loading and registering template plugins
 */

const fs = require('fs');
const path = require('path');

class PluginSystem {
  constructor(parser) {
    this.parser = parser;
    this.callbacks = {};
  }

  /**
   * Register all plugins from the plugins directory
   * @param {string} pluginsDir - Path to plugins directory
   */
  registerPlugins(pluginsDir) {
    if (!fs.existsSync(pluginsDir)) {
      console.error(`Plugins directory "${pluginsDir}" not found.`);
      return;
    }

    const files = fs.readdirSync(pluginsDir);
    files.forEach(file => {
      if (file !== 'register.js' && file.endsWith('.js')) {
        const pluginName = path.basename(file, '.js');
        const plugin = require(path.join(pluginsDir, file));
        
        // Store the plugin
        this.callbacks[pluginName] = plugin;
        
        // Register the plugin with the parser
        // Wrap the plugin to provide parser instance if needed
        const wrappedPlugin = (params, context, innerContent, data) => {
          return plugin(params, context, innerContent, data, this.parser.getParser());
        };
        
        this.parser.registerFunction(pluginName, wrappedPlugin);
      }
    });

    console.log('Plugins registered:', Object.keys(this.callbacks));
  }

  /**
   * Get a registered plugin by name
   * @param {string} pluginName - Name of the plugin to retrieve
   * @returns {function} - The plugin function
   */
  getPlugin(pluginName) {
    const sanitizedPluginName = pluginName.replace(/:/g, '_');
    return this.callbacks[sanitizedPluginName];
  }
}

module.exports = { PluginSystem };