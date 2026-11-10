'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { analyzeStylesheets } = require('../src/mcp/stylesheet-analysis');
const { analyzeCompatibility } = require('../src/mcp/css-compatibility');
const { analyzeResponsive } = require('../src/mcp/responsive-analysis');
const { validateTemplate } = require('../src/mcp/template-validation');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

// The same asset pipeline as Gourmet, invoked by tests only, never by validation.
async function buildFixture(root) {
  const compiler = webpack({
    context: root, mode: 'development', devtool: 'source-map',
    entry: { style: './src/scss/style.scss' },
    output: { path: path.join(root, 'compiled/assets/js'), filename: '[name].js' },
    module: { rules: [{ test: /\.scss$/, use: [MiniCssExtractPlugin.loader,
      { loader: require.resolve('css-loader'), options: { url: false, sourceMap: true } },
      { loader: require.resolve('sass-loader'), options: { sourceMap: true, sassOptions: { silenceDeprecations: ['import'] } } }
    ] }] },
    plugins: [new MiniCssExtractPlugin({ filename: '../css/[name].css' })]
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => compiler.close(closeError => {
    if (error || closeError) reject(error || closeError);
    else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })));
    else resolve();
  })));
}

const configuration = `const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
module.exports = {
 entry: {main: {import: './src/js/main.js', filename:'main.js'}, style:'./src/scss/style.scss'},
 output: {path:path.resolve(__dirname,'compiled/assets/js/'),filename:'[name].js'},
 plugins: [new MiniCssExtractPlugin({filename:'../css/[name].css'}),
 new CopyWebpackPlugin({patterns:[{from:'src/css',to:path.resolve(__dirname,'compiled/assets/css')}]})]
};`;
const cssFile = 'compiled/assets/css/style.css';
const write = (root, file, content) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); };

describe('Build-produced CSS validation (Gourmet regression)', function () {
  this.timeout(20000);
  let fixture, root, previous;
  before(async function () {
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-webpack-fixture-'));
    write(fixture, 'package.json', JSON.stringify({name:'gourmet-regression',scripts:{'build-assets':'grunt webpack'}}));
    write(fixture, 'webpack.config.js', configuration);
    write(fixture, 'Gruntfile.js', 'throw new Error("Validator must never execute Grunt");');
    write(fixture, 'src/js/main.js', 'console.log("app");');
    write(fixture, 'index.html', '<main>Example</main>');
    write(fixture, 'src/scss/style.scss', '@import "tokens";\n@import "components";\n');
    write(fixture, 'src/scss/_tokens.scss', '$hidden: none;\n$breakpoint: 600px;\n$wide: 900px;\n');
    write(fixture, 'src/scss/_components.scss', '.text-left {\n  > .btn {\n    display: $hidden;\n    @media (max-width: $breakpoint) {\n      min-width: $wide;\n    }\n  }\n}\nh1 { text-align: center !important; }\n');
    write(fixture, 'src/css/copied.css', '.bhb-pricing-table { all:unset }');
    await buildFixture(fixture);
    fs.copyFileSync(path.join(fixture, 'src/css/copied.css'), path.join(fixture, 'compiled/assets/css/copied.css'));
    write(fixture, 'compiled/assets/css/obsolete.css', 'h1 {display:none}');
  });
  after(function () { fs.rmSync(fixture, {recursive:true,force:true}); });
  beforeEach(function () {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-built-css-'));
    fs.cpSync(fixture, root, {recursive:true, preserveTimestamps:true});
    previous = process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = path.join(__dirname, 'fixtures/cms-contracts');
  });
  afterEach(function () {
    fs.rmSync(root, {recursive:true,force:true});
    if (previous === undefined) delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    else process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = previous;
  });
  it('discovers extracted and copied CSS, excludes obsolete outputs and avoids source duplication', function () {
    const result = analyzeStylesheets(root);
    assert.deepEqual(result.stylesheets, [cssFile, 'compiled/assets/css/copied.css']);
    assert.equal(result.assets.mode, 'compiled');
    assert.ok(result.sourceStylesheets.some(item => item.file === 'src/scss/_components.scss'));
    assert.ok(result.sourceStylesheets.some(item => item.file === 'src/css/copied.css'));
    assert.ok(result.selectors.every(item => item.file.startsWith('compiled/')));
    const reset = analyzeCompatibility(result).filter(item => item.ruleId === 'PS-CSS-103');
    assert.equal(reset.length, 1); assert.equal(reset[0].file, 'compiled/assets/css/copied.css');
  });
  it('matches Sass nesting/imports/variables after the existing Webpack pipeline resolves them', function () {
    const result = analyzeStylesheets(root);
    const selector = result.selectors.find(item => item.selector === '.text-left > .btn' && item.declarations.some(decl => decl.property === 'display'));
    assert.equal(selector.status, 'matched'); assert.equal(selector.matches[0].block, 'button');
    assert.equal(selector.declarations[0].value, 'none');
    assert.ok(result.sourceStylesheets.find(item => item.file === 'src/scss/style.scss').constructs.some(item => item.name === '@import'));
    assert.ok(!result.selectors.some(item => item.selector.includes('$') || item.selector.includes('&')));
  });
  it('attributes compiled compatibility findings to imported SCSS, preserving generated evidence', function () {
    const result = analyzeCompatibility(analyzeStylesheets(root));
    const hidden = result.find(item => item.ruleId === 'PS-CSS-101');
    assert.equal(hidden.file, 'src/scss/_components.scss'); assert.equal(hidden.line, 3);
    assert.equal(hidden.evidence.generated.file, cssFile);
    assert.equal(hidden.evidence.sourceMap, cssFile + '.map');
    assert.ok(result.some(item => item.ruleId === 'PS-CSS-102' && item.file.endsWith('_components.scss')));
  });
  it('analyzes resolved nested media queries and maps responsive declarations to SCSS', function () {
    const result = analyzeResponsive(analyzeStylesheets(root));
    const risk = result.findings.find(item => item.ruleId === 'PS-RESP-001');
    assert.equal(risk.file, 'src/scss/_components.scss'); assert.equal(risk.line, 5);
    assert.deepEqual(risk.evidence.media, ['(max-width: 600px)']);
    assert.equal(risk.evidence.declaration.value, '900px');
  });
  it('PS-ASSET-001 reports missing compiled CSS and retains source diagnostics without matching SCSS', function () {
    fs.unlinkSync(path.join(root, cssFile));
    write(root, 'src/scss/broken.scss', '.btn {');
    const result = analyzeStylesheets(root);
    assert.ok(result.findings.some(item => item.ruleId === 'PS-ASSET-001'));
    assert.ok(result.findings.some(item => item.ruleId === 'PS-CSS-001' && item.file === 'src/scss/broken.scss'));
    assert.ok(!result.selectors.some(item => item.selector === '.text-left > .btn'));
    assert.match(result.limitations.join(' '), /Missing compiled CSS/);
  });
  it('PS-ASSET-001 is absent when expected outputs exist', function () {
    assert.ok(!analyzeStylesheets(root).findings.some(item => item.ruleId === 'PS-ASSET-001'));
  });
  it('PS-ASSET-002 detects changed imported source-map contents even with older mtimes', function () {
    write(root, 'src/scss/_components.scss', 'h1 {color:green}');
    const old = new Date(1000); fs.utimesSync(path.join(root, 'src/scss/_components.scss'), old, old);
    const result = analyzeStylesheets(root);
    const stale = result.findings.find(item => item.ruleId === 'PS-ASSET-002' && item.file === cssFile);
    assert.equal(stale.evidence.status, 'stale');
    assert.ok(stale.evidence.changedInputs.includes('src/scss/_components.scss'));
    assert.ok(result.selectors.some(item => item.selector === '.text-left > .btn'));
  });
  it('PS-ASSET-002 distinguishes newer inputs from proven changes and never claims freshness', function () {
    const future = new Date(Date.now() + 10000); fs.utimesSync(path.join(root, 'src/scss/_tokens.scss'), future, future);
    assert.equal(analyzeStylesheets(root).findings.find(item => item.ruleId === 'PS-ASSET-002' && item.file === cssFile).evidence.status, 'possibly-stale');
    for (const file of [cssFile, 'compiled/assets/css/copied.css']) fs.utimesSync(path.join(root, file), new Date(Date.now()+20000), new Date(Date.now()+20000));
    const result = analyzeStylesheets(root);
    assert.ok(!result.findings.some(item => item.ruleId === 'PS-ASSET-002'));
    assert.ok(result.assets.artifacts.every(item => item.freshness === 'unknown'));
    assert.match(result.limitations.join(' '), /intermediate CSS/);
  });
  it('detects changed copied CSS by content and does not confuse SCSS edits with copied asset inputs', function () {
    const future = new Date(Date.now() + 10000); fs.utimesSync(path.join(root, 'src/scss/_tokens.scss'), future, future);
    const copiedFile = 'compiled/assets/css/copied.css';
    assert.ok(!analyzeStylesheets(root).findings.some(item => item.ruleId === 'PS-ASSET-002' && item.file === copiedFile));
    write(root, 'src/css/copied.css', '.changed {color:red}');
    const old = new Date(1000); fs.utimesSync(path.join(root, 'src/css/copied.css'), old, old);
    assert.equal(analyzeStylesheets(root).findings.find(item => item.ruleId === 'PS-ASSET-002' && item.file === copiedFile).evidence.status, 'stale');
  });
  it('falls back to generated locations for absent, invalid or unsafe source maps', function () {
    for (const contents of [null, 'not json', JSON.stringify({version:2})]) {
      const map = path.join(root, cssFile + '.map');
      if (contents === null) fs.rmSync(map, {force:true}); else fs.writeFileSync(map, contents);
      const finding = analyzeCompatibility(analyzeStylesheets(root)).find(item => item.ruleId === 'PS-CSS-101');
      assert.equal(finding.file, cssFile);
    }
    const output = path.join(root, cssFile);
    fs.appendFileSync(output, '\n/*# sourceMappingURL=https://example.invalid/never-fetch.map */');
    assert.match(analyzeStylesheets(root).limitations.join(' '), /Non-local source map reference/);
  });
  it('supports plain CSS without Webpack and explicit outputs for other build tools', function () {
    fs.unlinkSync(path.join(root, 'webpack.config.js'));
    fs.rmSync(path.join(root, 'src/scss'), {recursive:true}); fs.rmSync(path.join(root, 'compiled'), {recursive:true});
    assert.deepEqual(analyzeStylesheets(root).stylesheets, ['src/css/copied.css']);
    write(root, '.pagestudio/validation.json', JSON.stringify({css:{outputs:['public/theme.css'],sourceRoots:['src/css']}}));
    write(root, 'public/theme.css', 'h1 {display:none}');
    assert.deepEqual(analyzeStylesheets(root).stylesheets, ['public/theme.css']);
  });
  it('supports conventional compiled CSS without Webpack and reports reduced discovery certainty', function () {
    fs.unlinkSync(path.join(root, 'webpack.config.js'));
    const result = analyzeStylesheets(root);
    assert.equal(result.assets.mode, 'compiled');
    assert.ok(result.stylesheets.includes(cssFile));
    assert.match(result.limitations.join(' '), /conventional compiled CSS/);
    assert.ok(result.selectors.every(item => !item.file.endsWith('.scss')));
  });
  it('uses relative sources with sourceRoot and inline base64 source maps without network access', function () {
    const output = path.join(root, cssFile), mapFile = output + '.map';
    const map = JSON.parse(fs.readFileSync(mapFile));
    map.sourceRoot = '../../../';
    map.sources = map.sources.map(source => source.slice(source.indexOf('/./') + 3));
    fs.writeFileSync(mapFile, JSON.stringify(map));
    assert.equal(analyzeCompatibility(analyzeStylesheets(root)).find(item => item.ruleId === 'PS-CSS-101').file, 'src/scss/_components.scss');
    const css = fs.readFileSync(output, 'utf8').replace('sourceMappingURL=style.css.map', 'sourceMappingURL=data:application/json;base64,' + Buffer.from(JSON.stringify(map)).toString('base64'));
    fs.writeFileSync(output, css); fs.unlinkSync(mapFile);
    const finding = analyzeCompatibility(analyzeStylesheets(root)).find(item => item.ruleId === 'PS-CSS-101');
    assert.equal(finding.file, 'src/scss/_components.scss'); assert.equal(finding.evidence.sourceMap, 'inline');
  });
  it('PS-ASSET-003 reports unsupported dynamic configuration without executing scripts', function () {
    write(root, 'webpack.config.js', 'require("fs").writeFileSync("EXECUTED", "bad"); module.exports = () => ({});');
    write(root, 'package.json', JSON.stringify({scripts:{'build-assets':'touch EXECUTED'}}));
    assert.ok(analyzeStylesheets(root).findings.some(item => item.ruleId === 'PS-ASSET-003'));
    assert.ok(!fs.existsSync(path.join(root, 'EXECUTED')));
  });
  it('PS-ASSET-003 is absent for Gourmet static configuration and validation stays read-only', function () {
    const before = fs.readFileSync(path.join(root, cssFile));
    const config = fs.readFileSync(path.join(root, 'webpack.config.js'));
    const first = validateTemplate('index.html', root);
    assert.ok(!first.findings.some(item => item.ruleId === 'PS-ASSET-003'));
    assert.deepEqual(validateTemplate('index.html', root), first);
    assert.deepEqual(fs.readFileSync(path.join(root, cssFile)), before);
    assert.deepEqual(fs.readFileSync(path.join(root, 'webpack.config.js')), config);
  });
  it('handles unsafe outputs, dynamic paths and glob patterns as limitations without reading outside the project', function () {
    for (const output of ["process.env.UNKNOWN_CSS_DIR", "path.resolve(__dirname,'../outside')"]) {
      write(root, 'webpack.config.js', configuration.replace("path.resolve(__dirname,'compiled/assets/js/')", output));
      assert.ok(analyzeStylesheets(root).findings.some(item => item.ruleId === 'PS-ASSET-003'));
    }
    write(root, 'webpack.config.js', configuration.replace("from:'src/css'", "from:'src/css/*.css'"));
    assert.match(analyzeStylesheets(root).limitations.join(' '), /glob CopyWebpackPlugin/);
    write(root, 'webpack.config.js', configuration.replace("new MiniCssExtractPlugin({filename:'../css/[name].css'})", 'new MiniCssExtractPlugin(makeOptions())'));
    assert.match(analyzeStylesheets(root).limitations.join(' '), /Dynamic CSS plugin options/);
    write(root, '.pagestudio/validation.json', JSON.stringify({css:{outputs:['../outside.css']}}));
    assert.ok(analyzeStylesheets(root).findings.some(item => item.ruleId === 'PS-ASSET-003'));
  });
  it('returns compiled selector matches and mapped SCSS findings over MCP with legacy/structured parity', async function () {
    const client = new Client({name:'compiled-css-regression',version:'1.0.0'});
    const transport = new StdioClientTransport({command:process.execPath,args:[path.resolve(__dirname,'../bin/pagestudio-mcp.js')],
      env:{...process.env,PAGESTUDIO_PROJECT_ROOT:root,PAGESTUDIO_BLOCK_CONTRACTS_DIR:path.join(__dirname,'fixtures/cms-contracts')},stderr:'pipe'});
    try {
      await client.connect(transport);
      const response = await client.callTool({name:'pagestudio_validate_template',arguments:{file:'index.html'}});
      const result = JSON.parse(response.content[0].text);
      assert.deepEqual(result, response.structuredContent);
      assert.equal(result.analysis.assets.mode, 'compiled');
      assert.ok(result.findings.some(item => item.ruleId === 'PS-CSS-101' && item.file === 'src/scss/_components.scss'));
      assert.ok(result.analysis.selectors.every(item => item.file.startsWith('compiled/')));
    } finally { await client.close(); }
  });
});
