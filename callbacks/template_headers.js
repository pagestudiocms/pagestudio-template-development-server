const { LexParser } = require('../lib/lexParser');
const parser = new LexParser();
const path = require('path');
const fs = require('fs');
const { utils } = require('../lib/utils');

var templateConfig = null,
  serverConfig = null,
  templateConfigPath = path.join(process.cwd(), 'src', 'template.conf');

function generateLinkTags(templateConfig, needle = 'undefined') {
  let links = '';
  let group = needle !== 'undefined' ? needle : '';
  if (templateConfig[group]) {
    const stylesheets = templateConfig[group];
    for (const key in stylesheets) {
      if (stylesheets.hasOwnProperty(key)) {
        let href = stylesheets[key];
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
          href = `assets/${href}`;
        }
        links += `<link rel="stylesheet" href="${href}">\n`;
      }
    }
  }
  return links;
}

if (fs.existsSync(templateConfigPath)) {
  templateConfig = utils.readJson(templateConfigPath);
}

module.exports = (trigger, parameters = {}, content = '', data = {}) => {
  const stylesheetLinks = generateLinkTags(templateConfig, 'stylesheets');
  const webfontLinks = generateLinkTags(templateConfig, 'webfonts');

  const template = `
    <title>{{ site.title }}</title>
    <meta name="author" content="{{ site.author }}">
    <meta name="description" content="{{ site.description }}">
    <meta name="keywords" content="{{ site.keywords }}">

    <!-- Custom Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    ${webfontLinks}

    <!-- Theme CSS -->
    ${stylesheetLinks}
  `;

  let parsedContent = parser.parseVariables(template, data);
  return parsedContent;
};
