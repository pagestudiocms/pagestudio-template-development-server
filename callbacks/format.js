module.exports = (params, context) => {
  const value = context[params.variable] || '';
  if (params.format === 'uppercase') {
    return value.toUpperCase();
  }
  return value;  // Default to returning the original value
};
