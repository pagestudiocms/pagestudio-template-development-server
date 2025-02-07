// Step 1: Parse the template into an AST
function parseTemplate(template) {
  const tokens = [];
  const regex = /{{#if (.*?)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g;
  let match;

  while ((match = regex.exec(template)) !== null) {
    tokens.push({
      type: "if",
      condition: match[1].trim(),
      trueBlock: match[2].trim(),
      falseBlock: match[3].trim()
    });
  }

  return tokens;
}

// Step 2: Compile the AST into a JavaScript function
function compileTemplate(ast) {
  return function (context) {
    let output = "";

    ast.forEach(node => {
      if (node.type === "if") {
        if (context[node.condition]) {
          output += node.trueBlock;
        } else {
          output += node.falseBlock;
        }
      }
    });

    return output;
  };
}

// Step 3: Execute the compiled template with data
const template = `{{#if isActive}}<p>The item is active.</p>{{else}}<p>The item is inactive.</p>{{/if}}`;
const ast = parseTemplate(template);
console.log(ast);
const compiledFunction = compileTemplate(ast);

const context1 = { isActive: true };
const context2 = { isActive: false };
const context3 = {};

console.log(compiledFunction(context1)); // Output: <p>The item is active.</p>
console.log(compiledFunction(context2)); // Output: <p>The item is inactive.</p>
console.log(compiledFunction(context3)); // Output: <p>The item is inactive.</p>
