
module.exports = (value) => {
  if (typeof value === 'string') {
    return value.toUpperCase();
  }
  return value;
};
