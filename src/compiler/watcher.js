/**
 * File Watcher Module
 * Handles watching for file changes and triggering recompilation
 */

const chokidar = require('chokidar');
const path = require('path');
const colors = require('colors');

/**
 * Set up a file watcher for template files
 * @param {object} options - Watcher options
 * @param {string} options.src - Source directory
 * @param {function} options.onFileChange - Callback when a file changes
 * @returns {object} - The watcher instance
 */
const setupWatcher = (options) => {
  const { src, onFileChange } = options;
  
  /**
   * Executes the callback on file changes within passed folder.
   * Ignores changes on files matching `excludePatterns`.
   *
   * @param  {string} filePath - path of the changed file
   */
  function doCallback(filePath) {
    if ( ! filePath.endsWith('.html')) {
      return;
    }
    console.log(colors.cyan.bold('Change detected at %s'), filePath);
    if (typeof onFileChange === 'function') {
      onFileChange(filePath);
    }
  }
  
  const filepath = [
    path.join(src, 'layouts'),
    path.join(src, 'partials')
  ];

  const watcher = chokidar.watch(filepath, {
    persistent: true,
    awaitWriteFinish: true,
  });

  watcher.on('ready', () => {
    console.log(colors.green.bold('Initial scan complete. Watching for file changes in %s ...', filepath.join(', ')));
  });
  watcher.on('change', doCallback);
  watcher.on('add', doCallback);
  watcher.on('unlink', doCallback);

  // Print watched files after some time
  setTimeout(() => {
    console.log(watcher.getWatched());
  }, 500);

  return watcher;
};

module.exports = { setupWatcher };