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

        // Register the plugin with the parser.
        // We register a wrapper with arity 6 so the LexParser will pass the extended
        // signature including helpers. The wrapper dispatches to the original plugin
        // according to its declared parameters to preserve backwards compatibility.
        const wrappedPlugin = function(params, context, innerRaw, innerParsed, data, helpers) {
          // If the plugin expects the extended signature (6+ args), call it directly.
          if (plugin.length >= 6) {
            return plugin(params, context, innerRaw, innerParsed, data, helpers);
          }
          // If the plugin expects 5 args, assume signature (params, context, innerContent, data, parser)
          if (plugin.length === 5) {
            return plugin(params, context, innerParsed, data, this.parser.getParser());
          }
          // Fallback: legacy signature (params, context, innerContent, data)
          return plugin(params, context, innerParsed, data);
        }.bind(this);

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