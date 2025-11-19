#!/usr/bin/env node

/*!
 * Clean Command
 * Removes compiled files and build artifacts
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * Recursively delete a directory
 * @param {string} dirPath - Path to directory to delete
 */
function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

/**
 * Run the clean command
 * @param {object} options - Command options
 */
exports.run = (options) => {
  const targetDir = options.out || 'compiled';
  const targetPath = path.resolve(process.cwd(), targetDir);

  console.log(chalk.yellow(`🧹 Cleaning ${targetDir} directory...`));

  if (fs.existsSync(targetPath)) {
    try {
      deleteFolderRecursive(targetPath);
      console.log(chalk.green(`✓ Successfully removed ${targetDir}`));
    } catch (error) {
      console.error(chalk.red(`✗ Error cleaning ${targetDir}:`), error.message);
      process.exit(1);
    }
  } else {
    console.log(chalk.gray(`Directory ${targetDir} does not exist, nothing to clean.`));
  }
};
