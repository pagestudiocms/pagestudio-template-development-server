/**
 * Lowercase plugin
 * Transforms a string value to lowercase
 */

module.exports = (value) => {
  if (typeof value === 'string') {
    return value.toLowerCase();
  }
  return value;
};