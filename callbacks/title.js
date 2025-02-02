module.exports = (trigger, parameters = {}, content = '', data = {}) => {
  let variableValue = data[trigger] || '';

  const format = parameters.format ? parameters.format.toString().toLowerCase() : '';
  const formatMapping = {
    lowercase: () => variableValue.toLowerCase(),
    uppercase: () => variableValue.toUpperCase(),
  };

  // If the format exists in the mapping, apply it
  if (formatMapping[format]) {
    variableValue = formatMapping[format]();
  }

  return variableValue;
};
