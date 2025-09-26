/**
 * Uppercase plugin
 * Transforms a string value to uppercase
 */

module.exports = (value) => {
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  return value;
};