const path = require('path');
const fs = require('fs');
const { utils } = require('../lib/utils');

let templateConfig = null,
  templateConfigPath = path.join(process.cwd(), 'src', 'template.conf');

if (fs.existsSync(templateConfigPath)) {
  templateConfig = utils.readJson(templateConfigPath);
}

function findMenuByKey(jsonData, key = "primary-navigation") {
  if (!jsonData.navigations || !jsonData.navigations.items) {
    return null; // Return null if structure is invalid
  }
  const navigationItem = jsonData.navigations.items.find(item => item.name === key);
  return navigationItem ? navigationItem.menu || [] : null; // Return menu array or null if not found
}

function createMenuItems(items) {
  let html = "";
  items.forEach((item, index) => {
    let classes = [];
    if (index === 0) classes.push("first");
    if (item.active) classes.push("active");
    if (item.class) classes.push(item.class);

    if (item.children) {
      // Dropdown menu
      html += `<li class="dropdown ${classes.join(" ")}">
                  <a href="${item.url || "#"}" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-haspopup="true" aria-expanded="false">
                    ${item.label} <span class="caret"></span>
                  </a>
                  <ul class="dropdown-menu">
                    ${createMenuItems(item.children)}
                  </ul>
              </li>`;
    } else if (item.divider) {
      // Divider
      html += `<li role="separator" class="divider"></li>`;
    } else {
      // Regular menu item
      html += `<li class="${classes.join(" ")}">
                  <a href="${item.url}">${item.label}</a>
              </li>`;
    }
  });
  return html;
}

module.exports = (params, context, innerContent, data = {}, parser) => {
  let classList = params.class ? params.class : '';
  let navId = params.nav_id && isNaN(params.nav_id) ? params.nav_id : '';

  /**
   * Example JSON data
   * 
   * const menuJson = [
   *   { "label": "Home", "url": "default.html", "active": true },
   *   {
   *     "label": "Pages", "children": [
   *       { "label": "About", "url": "about.html" },
   *       { "label": "Dashboard", "url": "dashboard.html" },
   *       { "label": "Checkout", "url": "checkout.html" },
   *       { "label": "Something else here", "url": "#" },
   *       { "divider": true },
   *       { "label": "Separated link", "url": "#" },
   *       { "divider": true },
   *       { "label": "One more separated link", "url": "#" }
   *     ]
   *   },
   *   { "label": "Blog", "url": "posts.html" },
   *   { "label": "Components", "url": "components.html" },
   *   { "label": "Get Started", "url": "templates.html", "class": "btn-cta btn-cta--blue" }
   * ];
   */
  let menuJson = findMenuByKey(templateConfig, navId);

  let menuHtml = "";
  
  if(typeof menuJson !== 'undefined' && menuJson !== null) {
    menuHtml = createMenuItems(menuJson);
  }

  const template = `
  <ul class="nav navbar-nav ${classList.trim()}">
    ${menuHtml}
  </ul>
  ${innerContent.trim()}
  `;

  let parsedContent = parser.parse(template, context, data);
  return parsedContent;
};