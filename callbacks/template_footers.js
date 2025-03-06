const path = require('path');
const fs = require('fs');
const { utils } = require('../lib/utils');

let templateConfig = null,
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
        links += `<script src="${href}"></script>\n`;
      }
    }
  }
  return links;
}

if (fs.existsSync(templateConfigPath)) {
  templateConfig = utils.readJson(templateConfigPath);
}

module.exports = (params, context, innerContent, data = {}, parser) => {
  const javascriptLinks = generateLinkTags(templateConfig, 'javascripts');

  const template = `
    <!-- CMS JavaScript Links -->
    <script src="https://cdn.pagestudiocms.com/assets/vendors/jquery/jquery-2.1.4.min.js"></script>
    <script src="https://cdn.pagestudiocms.com/assets/vendors/bootstrap/3.3.6/js/bootstrap.min.js"></script>
    <script src="https://cdn.pagestudiocms.com/assets/vendors/wow/1.1.0/dist/wow.min.js"></script>
    <script src="https://cdn.pagestudiocms.com/assets/vendors/jquery-validate/1.17.0/jquery.validate.min.js"></script>

    <!-- Theme JavaScript Links -->
    ${javascriptLinks}

    ${innerContent.trim()}
  `;

  let parsedContent = parser.parse(template, context, data);
  return parsedContent;
};
