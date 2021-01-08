// Adding commands to script key in package.json at root level of project
const saveFile = require('fs').writeFileSync;
const pkgJsonPath = require.main.paths[0].split('node_modules')[0] + 'package.json';
const json = require(pkgJsonPath);

if (!json.hasOwnProperty('dependencies')) {
  json.dependencies = {};
}

if (!json.hasOwnProperty('scripts')) {
  json.scripts = {};
}

json.dependencies['npm-run-all'] = "^4.1.5";
json.scripts['sass:build'] = "node-sass --output-style compressed src/scss/style.scss -o build/assets/css --source-map true";
json.scripts['sass:watch'] = "node-sass src/scss/style.scss -wo build/assets/css --source-map true";
json.scripts['start'] = "npm-run-all --parallel sass:watch start-server",
json.scripts['start-server'] = "node ./node_modules/@pagestudiocms/pagestudio-template-development-server/server.js";

saveFile(pkgJsonPath, JSON.stringify(json, null, 2));