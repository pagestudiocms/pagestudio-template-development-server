# PageStudio Node Development Server

This Node.js command-line tool sets up a development server that simplifies local development for PageStudio template developers. It watches for changes in template, SCSS, and JavaScript files, automatically recompiling them and allowing developers to work with templates locally in real time.

## Features

- Local development server running on `http://localhost:8080/`.
- Watch for changes in template, SCSS, and JS files.
- Template compilation, asset bundling, and live reloading.
- Integrated with Grunt and Webpack for JS/SCSS compilation and bundling.

## Installation

### Install as an npm Package

You can install this package directly from npm or GitHub, depending on where it's published.

#### From npm:

```bash
npm install @pagestudiocms/pagestudio-template-development-server
```

#### From GitHub:

```bash
npm install git+https://github.com/your-username/pagestudio-template-development-server.git
```

After installation, the development server will be available to run as an npm script from your project.

### Requirements

- **Node.js** (Ensure you have Node.js installed on your system. You can download it from [nodejs.org](https://nodejs.org/).)

## Usage

### Start the Development Server

Once the package is installed, you can run the development server using npm:

```bash
npm run start-server
```

This command will start the server, and you can access your project locally at:

```
http://localhost:9000/
```

The server will automatically watch for changes in your template, SCSS, and JavaScript files, recompiling them as necessary.

### Watching and Rebuilding Files

The package is configured to use Grunt to watch and recompile the assets as needed. You can run the watch task with:

```bash
npm run grunt:watch
```

### Manual Template Compilation

To manually compile templates and assets, use the following command (replace paths with your source files):

```bash
node bin/compile.js --src src/html --dest dist --dataDir src/html/data --partials src/html/partials
```

## Project Structure

Here’s an overview of the project’s directory structure:

```
project/
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
├── server.js                # Server setup for development
└── webpack.config.js        # Webpack configuration
```

### Grunt and Webpack Integration

- **Grunt**: Manages the watch task to automatically recompile SCSS, JS, and template files.
- **Webpack**: Bundles and optimizes JavaScript and other assets for production.

You can modify `webpack.config.js` and `Gruntfile.js` to suit your specific project needs.

## Customization

- **Template Compilation**: You can manually trigger the template compilation by running `node bin/compile.js` with the appropriate flags for your project.
- **Server Configuration**: The development server is based on `live-server` and runs by default at `http://localhost:9000/`. You can modify `server.js` to change server settings or routes.
