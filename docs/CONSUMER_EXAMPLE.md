# Consumer Project Example

This is an example of how to use `@pagestudiocms/pagestudio-template-development-server` in your own PageStudio template project.

## Setup

1. Install the development server:
```bash
npm install @pagestudiocms/pagestudio-template-development-server
```

2. Add scripts to your `package.json`:
```json
{
  "name": "my-pagestudio-theme",
  "scripts": {
    "dev": "pagestudio-dev",
    "build": "pagestudio-compile",
    "serve": "pagestudio-server --port 8080"
  },
  "dependencies": {
    "@pagestudiocms/pagestudio-template-development-server": "^2.1.0-beta1"
  }
}
```

3. Create a `site.config.json` (optional):
```json
{
  "src": "templates",
  "out": "dist",
  "layouts": "templates/layouts",
  "partials": "templates/partials", 
  "data-src": "templates/data",
  "port": 8080,
  "open": true
}
```

## Usage

### Development Mode
Start the full development environment (compiler + server):
```bash
npm run dev
```

### Build Only
Compile templates without starting server:
```bash
npm run build
```

### Server Only
Start server without compilation:
```bash
npm run serve
```

### Custom Configuration
Use command line options:
```bash
npx pagestudio-dev --src my-templates --port 9000 --config my-config.json
```

## Project Structure

```
my-pagestudio-theme/
├── templates/
│   ├── layouts/
│   │   ├── default.html
│   │   └── about.html
│   ├── partials/
│   │   ├── header.html
│   │   └── footer.html
│   └── data/
│       ├── default.data.json
│       └── about.data.json
├── assets/
│   ├── css/
│   └── js/
├── dist/           # Compiled output
├── site.config.json
└── package.json
```