/**
 * File Watcher Module
 * Handles watching for file changes and triggering recompilation
 */

const chokidar = require('chokidar');
const path = require('path');

/**
 * Set up a file watcher for template files
 * @param {object} options - Watcher options
 * @param {string} options.src - Source directory
 * @param {function} options.onFileChange - Callback when a file changes
 * @returns {object} - The watcher instance
 */
const setupWatcher = (options) => {
  const { src, onFileChange } = options;
  
  console.log('Watching for file changes...');
  const filepath = [
    path.join(src, 'layouts'),
    path.join(src, 'partials')
  ];

  const watcher = chokidar.watch(filepath, {
    persistent: true,
    awaitWriteFinish: true,
  });

  watcher.on('change', (filePath) => {
    if (filePath.endsWith('.html')) {
      console.log(`File changed: ${filePath}`);
      onFileChange(filePath);
    }
  });

  // Print watched files after some time
  setTimeout(() => {
    console.log(watcher.getWatched());
  }, 500);

  return watcher;
};

module.exports = { setupWatcher };