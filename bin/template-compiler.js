const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const glob = require('glob');
const chokidar = require('chokidar');
const commandLineArgs = require('command-line-args');
const { LexParser } = require('../lib/lexParser');

const parser = new LexParser();

// Import the callback registration and retrieval functions
const { registerCallbacks, getCallback } = require('../callbacks/register');

// Define CLI argument options
const options = [
  { name: "src", alias: "s", type: String, defaultValue: "src" },
  { name: "dest", alias: "d", type: String, defaultValue: "dist" },
  { name: "partials", alias: "p", type: String, defaultValue: "src/partials" },
  { name: "data-src", alias: "a", type: String, defaultValue: "src/html/data" }, // Directory for data.json files
];
const args = commandLineArgs(options);

// Load partial templates from the specified directory
const loadPartials = (partialsDir) => {
  const partials = {};
  if (fs.existsSync(partialsDir)) {
    const partialFiles = glob.sync(path.join(partialsDir, '*.html'));
    partialFiles.forEach((filePath) => {
      const partialName = path.basename(filePath, '.html');
      partials[partialName] = fs.readFileSync(filePath, 'utf-8');
    });
  } else {
    console.error(`Partials directory "${partialsDir}" not found.`);
  }
  return partials;
};

// Function to compile and save the layout files
const compileFile = (filePath, args, partials) => {
  let layoutContent = fs.readFileSync(filePath, 'utf-8');
  const layoutName = path.basename(filePath, '.html');
  const dataFilePath = path.join(args['data-src'], `${layoutName}.data.json`);

  // Load the context for the current layout if available
  let context = {};
  if (fs.existsSync(dataFilePath)) {
    context = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8')); // Load specific context if the data file exists
  } else {
    console.log(`No data found for "${layoutName}". Using default context.`);
  }

  partials = loadPartials(args.partials);
  // Process the template content
  layoutContent = processTemplate(layoutContent, context, partials);

  // Define the output path for the compiled layout in the dist folder
  const relativeFilePath = path.relative(args.src, filePath); // Remove the "src" folder part
  const distFilePath = path.join(args.dest, relativeFilePath);

  // Remove 'layouts' from the file path (we don't want the "layouts" folder in dist)
  const distFilePathWithoutLayouts = distFilePath.replace(/layouts\//, '');

  // Create the necessary directories in the dist folder
  fse.ensureDirSync(path.dirname(distFilePathWithoutLayouts));

  // Save the processed layout file to the dist directory
  fse.outputFileSync(distFilePathWithoutLayouts, layoutContent);
  console.log(`Processed and saved: ${distFilePathWithoutLayouts}`);
};

const processTemplate = (layoutContent, context, partials) => {
  let parsedContent = layoutContent;
  let partialRegex = /{{\s*template:partial\s+name="([\w-]+)"\s*}}/g;

  // Process partials first
  parsedContent = parsedContent.replace(partialRegex, (match, partialName) => {
    // console.log(`Processing partial: ${partialName}`);
    if (partials[partialName]) {
      // Process the partial content recursively in case it contains more partials
      return processTemplate(partials[partialName], context, partials);
    } else {
      console.error(`Partial "${partialName}" not found.`);
      return ''; // If partial is not found, replace with nothing
    }
  });

  function parserCallbackLoader(callbackName, parameters, content, data) {
    if (parameters) {
      const callback = getCallback(callbackName);
      if (callback) {
        return callback(callbackName, parameters, content, data);
      }
    }

    return content || typeof data[callbackName] !== 'undefined' ? data[callbackName] : '';
  }

  // After processing the partials, parse the content with the provided context and callbacks
  parsedContent = parser.parse(parsedContent, context, parserCallbackLoader);

  return parsedContent;
};

// Watch the source directory for changes
const watchSource = () => {
  console.log('Watching for file changes...');
  const filepath = [path.join(args.src, 'layouts')];

  const watcher = chokidar.watch(filepath, {
    persistent: true,
    awaitWriteFinish: true,
  });

  watcher.on('change', (filePath) => {
    if (filePath.endsWith('.html')) {
      console.log(`File changed: ${filePath}`);
      const partials = loadPartials(args.partials);
      compileFile(filePath, args, partials);
    }
  });

  // Print watched files after some time
  setTimeout(() => {
    console.log(watcher.getWatched());
  }, 500);
};

// Main function to process files
const compile = () => {
  // Register callbacks
  registerCallbacks();

  const partials = loadPartials(args.partials); // Load partial templates

  // Initially process all the layout files in the src directory
  glob(path.join(args.src, 'layouts', '**/*.html'), (err, files) => {
    if (err) {
      console.error('Error reading files:', err);
      return;
    }

    // Process each layout file
    files.forEach((filePath) => {
      compileFile(filePath, args, partials);
    });
  });

  // Watch for changes in the source directory
  watchSource();
};

// Start the process
compile();
