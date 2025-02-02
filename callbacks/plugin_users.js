const LexParser = require('../lib/lexParser');
const parser = new LexParser();

module.exports = (trigger, parameters = {}, content = '', data = {}) => {
  const pluginData = {
    "users": [
      {
        name: 'John Doe',
        email: 'john@demowebsite.com'
      },
      {
        name: 'Jane Doe',
        email: 'jane@demowebsite.com'
      }
    ]
  };
  const originalContent = content;
  const newContent = `{{ users }} ${originalContent} {{ /users }}`;

  let parsedContent = parser.parseVariables(newContent, pluginData);
  return parsedContent;
};
