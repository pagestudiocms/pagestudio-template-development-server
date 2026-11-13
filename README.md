# PageStudio Node Development Server

This Node.js command-line tool sets up a development server that simplifies local development for PageStudio template developers. It watches for changes in template, SCSS, and JavaScript files, automatically recompiling them and allowing developers to work with templates locally in real time.

## Features

- Local development server with live reloading
- Watch for changes in template, SCSS, and JS files
- Template compilation, asset bundling, and live reloading
- Integrated with Grunt and Webpack for JS/SCSS compilation and bundling
- Easy-to-use CLI commands for different development workflows

## Installation

### Install as an npm Package

This scoped package publishes to GitHub Packages. Configure the scope registry and authenticate with package-read access before installing; never commit tokens.

#### From npm:

```bash
npm config set @pagestudiocms:registry https://npm.pkg.github.com
npm install --save-dev @pagestudiocms/pagestudio-template-development-server
```

#### From GitHub:

```bash
npm install git+https://github.com/pagestudiocms/pagestudio-template-development-server.git
```

### Requirements

- **Node.js >=20** (use a currently supported Node release).

## Codex VS Code onboarding

Use a release or local checkout containing `init` and `doctor`; confirm with
`npx --no-install pagestudio --help`. Codex CLI is not required.

```sh
npx --no-install pagestudio init --agent codex --dry-run
npx --no-install pagestudio init --agent codex
npx --no-install pagestudio contracts sync --from "/absolute/path/to/verified-cms-export"
npx --no-install pagestudio doctor
```

Reuse the project's dev owner, or start its existing `npm run start` workflow once.
Reload VS Code and open a new Codex session to discover and invoke PageStudio tools.
Doctor verifies local setup and the MCP protocol; native invocation stays unverified
until observed. See the [complete setup and troubleshooting guide](docs/agent-workflow/README.md)
for local-checkout installation, merge behavior, trust and portable examples.

## Usage

### CLI Commands

After installation, you have access to three main CLI commands:

#### 1. Full Development Environment (Recommended)

```bash
npx pagestudio dev
```

This command starts both the template compiler (with file watching) and the development server. It's the easiest way to get started.

**Options:**
```bash
npx pagestudio dev --src templates --out dist --port 8080 --config my-config.json
```

- `--src <path>` - Source directory (default: `src/html`)
- `--out <path>` - Output directory (default: `compiled`)
- `--layouts <path>` - Layouts directory (default: `src/html/layouts`)
- `--partials <path>` - Partials directory (default: `src/html/partials`)
- `--data-src <path>` - Data directory (default: `src/html/data`)
- `--port <number>` - Server port (default: `3000`)
- `--open <boolean>` - Open browser automatically (default: `true`)
- `--config <path>` - Config file path
- `--help, -h` - Show help

#### 2. Template Compilation Only

```bash
npx pagestudio compile
```

Compiles templates without starting the server. Useful for build processes.

#### 3. Development Server Only

```bash
npx pagestudio server
```

Starts only the development server without template compilation.

### Using in Your Project

Add to your project's `package.json`:

```json
{
  "scripts": {
    "dev": "pagestudio dev",
    "build": "pagestudio compile",
    "serve": "pagestudio server"
  }
}
```

Then run:

```bash
npm run dev    # Start full development environment
npm run build  # Compile templates only
npm run serve  # Start server only
```

### Configuration File

Create a `site.config.json` file in your project root:

```json
{
  "src": "src/html",
  "out": "compiled",
  "layouts": "src/html/layouts",
  "partials": "src/html/partials",
  "data-src": "src/html/data",
  "assets": "src/assets",
  "port": 3000,
  "open": true,
  "watch": true
}
```

## Project Structure

Here’s an overview of the project’s directory structure:

```
pagestudio-template-development-server/
├── bin/
│   └── template-compiler.js     # 🔧 SECONDARY: Specialized compilation tool
├── node_modules/            # Installed npm packages
├── build/                   # Output directory (compiled templates, assets)
│   ├── assets/
│   │   ├── css/             # Compiled CSS files
│   │   └── js/              # Bundled JS files
│   ├── layouts/             # Built layout templates
│   └── partials/            # Built partial templates
├── callbacks/               # Template engine callbacks
├── lib/                     # Utilities and core logic
│   └── compile.js           # Compilation logic
│   └── lexParser.js         # Lexing and parsing functions
│   └── utils.js             # Utility functions
├── src/                     # Source files
│   ├── js/                  # Source JavaScript files
│   ├── scss/                # SCSS source files
│   └── template/            # Template source files
│       ├── layouts/         # Layout templates (e.g., main layout)
│       └── partials/        # Partial templates (e.g., header, footer)
├── Gruntfile.js             # Grunt tasks configuration
├── package.json             # Project dependencies and scripts
├── server.js                # 🎯 PRIMARY: Main development server
└── webpack.config.js        # Webpack configuration
```

### Grunt and Webpack Integration

- **Grunt**: Manages the watch task to automatically recompile SCSS, JS, and template files.
- **Webpack**: Bundles and optimizes JavaScript and other assets for production.

You can modify `webpack.config.js` and `Gruntfile.js` to suit your specific project needs.

## Customization

- **Template Compilation**: You can manually trigger the template compilation by running `node bin/compile.js` with the appropriate flags for your project.
- **Server Configuration**: The development server is based on `live-server` and runs by default at `http://localhost:9000/`. You can modify `server.js` to change server settings or routes.

## Tests

Run tests

> npm test
