const fs = require('fs');
const path = require('path');

// Object to store registered callbacks
const callbacks = {};

// Register callbacks by reading from the callbacks directory
const registerCallbacks = () => {
  const callbacksDir = path.join(__dirname, '/');
  const files = fs.readdirSync(callbacksDir);

  files.forEach(file => {
    if(file !== 'register.js') {
      const callbackName = path.basename(file, '.js');
      const callback = require(path.join(callbacksDir, file));
      callbacks[callbackName] = callback; // Register each callback
    }
  });

  console.log('Callbacks registered:', Object.keys(callbacks));
};

// Getter to access the registered callbacks
const getCallback = (callbackName) => {
  const sanitizedCallbackName = callbackName.replace(/:/g, '_'); // Transforms plugin:name to plugin_name for file lookup as plugin_name.js
  return callbacks[sanitizedCallbackName];
}
module.exports = { registerCallbacks, getCallback };
