const { compile } = require("sass");

/**
 * LexParser: A JavaScript Lex-style HTML template parser for CodeIgniter 2 Lex templates.
 *
 * Features:
 * - Variables: {{ variable }} (supports dot-notation)
 * - Loops: {{ items }} ... {{ /items }} (iterates over arrays or objects)
 * - Conditionals: 
 *      {{ if condition }} ... {{ elseif condition }} ... {{ else }} ... {{ endif }}
 *      {{ unless condition }} and {{ elseunless condition }} are sugar for negated conditions.
 * - Plugin callbacks: 
 *      Tags with a colon (e.g. {{ content:snippet param="example" }}) are mapped to a callback
 *      registered as "content_snippet". Callback blocks allow enclosed content.
 * - All callbacks receive (params, context, innerContent, data), where "data" is an optional JSON object.
 * @version 1.1.0
 */
class LexParser {
  constructor() {
    // Registry for plugin callback functions.
    this.callbacks = {};
  }

  /**
   * Registers a callback function for a given plugin tag.
   * @param {string} name - The callback name (e.g., "content_snippet").
   * @param {function} handler - A function with signature (params, context, innerContent, data).
   */
  registerFunction(name, handler) {
    this.callbacks[name] = handler;
  }

  /**
   * Main method to parse and render a template.
   * @param {string} template - The template string.
   * @param {object} context - Data for variable interpolation.
   * @param {object} data - Additional JSON data passed to callbacks.
   * @returns {string} - The rendered output.
   */
  parse(template, context = {}, data = {}) {
    const tokens = this.tokenize(template);
    // console.log(tokens)
    const ast = this.buildAST(tokens);
    // console.log(ast)
    return this.render(ast, context, data);
  }

  /**
   * Tokenizes the template into an array of tokens.
   * Recognizes tags of the form:
   *   {{ [/]? tagName [parameters] }}
   * where tagName may be a variable name (e.g. "title"), a plugin (e.g. "content:snippet"),
   * or a conditional keyword (if, elseif, else, unless, elseunless, endif).
   *
   * @param {string} template - The template string.
   * @returns {Array} - Array of token objects.
   */
  tokenize(template) {
    // Regex breakdown:
    // 1. Optional leading slash for closing tags.
    // 2. The tag name (alphanumeric, underscores, and possibly a colon).
    // 3. Optional parameters.
    // const regex = /{{\s*(\/?)([a-zA-Z0-9_]+(?::[a-zA-Z0-9_]+)?|if|elseif|else|unless|elseunless|endif)(?:\s+([^}]+))?\s*}}/g;
    const regex = /{{\s*(\/?)([a-zA-Z0-9_.]+(?::[a-zA-Z0-9_]+)?|if|elseif|else|unless|elseunless|endif)(?:\s+([^}]+))?\s*}}/g;
    let tokens = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(template)) !== null) {
      // Capture any text before the tag as a text token.
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', value: template.slice(lastIndex, match.index) });
      }
      const closing = match[1] === '/';
      const tag = match[2];
      const params = (match[3] || "").trim();
      let tokenType = 'variable'; // default

      // Recognize conditionals.
      if (['if', 'elseif', 'else', 'unless', 'elseunless', 'endif'].includes(tag)) {
        tokenType = 'conditional';
      }
      // Recognize plugin callbacks (tags containing a colon).
      else if (tag.indexOf(':') !== -1) {
        tokenType = 'callback';
      }
      // (Otherwise, it's a simple variable tag.)

      tokens.push({ type: tokenType, tag, params, closing });
      lastIndex = regex.lastIndex;
    }
    // Add any trailing text.
    if (lastIndex < template.length) {
      tokens.push({ type: 'text', value: template.slice(lastIndex) });
    }

    return tokens;
  }

  /**
   * Builds an Abstract Syntax Tree (AST) from the token list.
   * This implementation uses a stack to support nested structures.
   *
   * The AST node types are:
   * - Text: { type: 'text', value: string }
   * - Variable: { type: 'variable', tag: string }
   * - Loop: { type: 'loop', variable: string, children: [...] }
   * - Callback: { type: 'callback', name: string, params: object, children: [...] }
   * - Conditional: { type: 'conditional', conditions: [...], elseBranch: { children: [...] } (optional) }
   *
   * @param {Array} tokens - Array of token objects.
   * @returns {object} - The AST root.
   */
  buildAST(tokens) {
    let root = { type: 'root', children: [] };
    let stack = [root];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      // Ensure the current parent is a proper container.
      let currentParent = stack[stack.length - 1];
      if (!currentParent) {
        console.warn("Warning: currentParent is undefined; falling back to root node.");
        currentParent = root;  // Assuming 'root' is available in your scope.
      }

      if (token.type === 'text' || (token.type === 'variable' && !token.closing)) {
        // For variable tokens, check if a matching closing token exists later.
        if (token.type === 'variable') {
          const isLoop = tokens.slice(i + 1).some(t => t.type === 'variable' && t.closing && t.tag === token.tag);
          if (isLoop) {
            // Start a loop node.
            let loopNode = { type: 'loop', variable: token.tag, children: [] };
            currentParent.children.push(loopNode);
            stack.push(loopNode);
            continue; // Do not add the opening token separately.
          }
        }
        // For text or simple variable interpolation:
        currentParent.children.push(token);
      } else if (token.type === 'variable' && token.closing) {
        // Closing a loop block.
        if (stack[stack.length - 1].type === 'loop' && stack[stack.length - 1].variable === token.tag) {
          stack.pop();
        }
      } else if (token.type === 'callback') {
        if (!token.closing) {
          // Opening callback block.
          let callbackNode = {
            type: 'callback',
            name: this.mapPluginName(token.tag),
            params: this.parseParameters(token.params),
            children: []
          };
          currentParent.children.push(callbackNode);
          stack.push(callbackNode);
        } else {
          // Closing callback tag.
          if (stack[stack.length - 1].type === 'callback' &&
            stack[stack.length - 1].name === this.mapPluginName(token.tag)) {
            stack.pop();
          }
        }
      } else if (token.type === 'conditional') {
        // Helper function to find the current conditional node.
        let self = this;
        function findConditionalNode(stack) {
          for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i].type === 'conditional') {
              return stack[i];
            }
          }
          return null;
        }

        // Process conditional tokens.
        if (token.tag === 'if' || token.tag === 'unless') {
          // Start a new conditional node.
          let condNode = {
            type: 'conditional',
            conditions: [{ type: token.tag, expression: token.params, children: [] }],
            elseBranch: null
          };
          currentParent.children.push(condNode);
          this.currentConditional = condNode;
          // Push the conditional branch container onto the stack.
          stack.push(condNode.conditions[0]);
        } else if (token.tag === 'elseif' || token.tag === 'elseunless') {
          // End the current branch and start a new condition branch.
          stack.pop();

          let condNode = findConditionalNode(stack[0].children);
          if (!condNode) {
            console.warn("Malformed template: no conditional node found for " + token.tag);
          }
          if (condNode && condNode.type === 'conditional') {
            let newBranch = { type: token.tag, expression: token.params, children: [] };
            condNode.conditions.push(newBranch);
            stack.push(newBranch);
          }
        } else if (token.tag === 'else') {
          // End current branch and create an else branch container.
          stack.pop();
          if (this.currentConditional) {
            let elseBranch = { type: 'else', children: [] };
            this.currentConditional.elseBranch = elseBranch;
            stack.push(elseBranch);
            // Optionally, reset this.currentConditional if needed at endif.
          }
        } else if (token.tag === 'endif') {
          // End the conditional block.
          if (stack.length > 0) {
            stack.pop();
          }
        }
      }
    }
    // console.log(JSON.stringify(stack))
    return root;
  }

  /**
   * Renders the AST recursively.
   * @param {object} ast - The AST root.
   * @param {object} context - Data for variable interpolation.
   * @param {object} data - Additional global data for callbacks.
   * @returns {string} - The final rendered output.
   */
  render(ast, context, data) {
    let output = '';
    for (const node of ast.children) {
      output += this.renderNode(node, context, data);
    }
    return output;
  }

  /**
   * Renders an individual AST node.
   * @param {object} node - The AST node.
   * @param {object} context - The current variable context.
   * @param {object} data - Global data for callbacks.
   * @returns {string} - Rendered output for the node.
   */
  renderNode(node, context, data) {
    switch (node.type) {
      case 'text':
        return node.value;
      case 'variable':
        return this.resolveVariable(node.tag, context);
      case 'loop': {
        let loopData = this.resolveVariable(node.variable, context);
        let result = '';
        if (Array.isArray(loopData)) {
          for (let item of loopData) {
            result += node.children.map(child => this.renderNode(child, item, data)).join('');
          }
        } else if (typeof loopData === 'object' && loopData !== null) {
          for (let key in loopData) {
            result += node.children.map(child => this.renderNode(child, loopData[key], data)).join('');
          }
        }
        return result;
      }
      case 'callback': {
        const innerContent = node.children.map(child => this.renderNode(child, context, data)).join('');
        const fn = this.callbacks[node.name];
        if (typeof fn === 'function') {
          return fn(node.params, context, innerContent, data);
        }
        return innerContent; // Return inner content if callback is not found.
      }
      // Rendering for conditional branches.
      // Here, the conditional node stores its branches in "conditions"
      // and an optional elseBranch.
      case 'conditional': {
        // Evaluate each condition branch in order.
        for (const branch of node.conditions) {
          let condValue = this.evaluateExpression(branch.expression, context);
          // Invert the condition if type is 'unless' or 'elseunless'
          if (branch.type === 'unless' || branch.type === 'elseunless') {
            condValue = !condValue;
          }
          if (condValue) {
            return branch.children.map(child => this.renderNode(child, context, data)).join('');
          }
        }
        if (node.elseBranch) {
          return node.elseBranch.children.map(child => this.renderNode(child, context, data)).join('');
        }
        return '';
      }
      // In our AST, branches (for conditionals) are plain containers.
      case 'else':
      case 'if':
      case 'elseif':
      case 'unless':
      case 'elseunless':
        return node.children.map(child => this.renderNode(child, context, data)).join('');
      default:
        return '';
    }
  }

  /**
   * Maps a plugin tag to its callback name.
   * For example, "content:snippet" becomes "content_snippet".
   * @param {string} tag - The raw tag name.
   * @returns {string} - The mapped callback name.
   */
  mapPluginName(tag) {
    return tag.replace(':', '_');
  }

  /**
   * Parses a parameter string into a key/value object.
   * Supports key="value" pairs.
   * @param {string} paramStr - The parameter string.
   * @returns {object} - Parsed parameters.
   */
  parseParameters(paramStr) {
    const params = {};
    const regex = /(\w+)\s*=\s*"([^"]*)"/g;
    let match;
    while ((match = regex.exec(paramStr)) !== null) {
      params[match[1]] = match[2];
    }
    return params;
  }

  /**
   * Resolves a variable from the context using dot-notation.
   * For example, "real_name.first" looks up context.real_name.first.
   * @param {string} varName - The variable name.
   * @param {object} context - The context object.
   * @returns {any} - The variable's value, or an empty string if not found.
   */
  resolveVariable(varName, context) {
    console.log(`Resolve variable: ${varName}`);
    if (varName.startsWith('"') || varName.startsWith("'")) {
      return varName.slice(1, -1); // Remove surrounding quotes
    }
    // Handle dot notation for nested properties (e.g., user.group)
    return varName.split('.').reduce((obj, key) => obj && obj[key], context);
  }

  /**
   * Evaluates a conditional expression in the current context.
   * Supports PHP-like comparison (==, !=, >, <, >=, <=)
   * and logical operators (and, or, not).
   *
   * WARNING: This basic implementation uses eval() for simplicity.
   * In production, use a safe expression evaluator.
   *
   * @param {string} expression - The conditional expression.
   * @param {object} context - The current context.
   * @returns {boolean} - The result of the evaluation.
   */
  evaluateExpression(expression, context) {
    let expr = expression;
    expr = expr.replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\b/g, '!');

    // Use a regex that matches either a quoted string or a variable token.
    // Group 1 will capture a quoted string; Group 2 will capture an unquoted variable.
    // expr = expr.replace(/(".*?"|'.*?'|[a-zA-Z_][a-zA-Z0-9_.]*)/g, (variable) => {
    expr = expr.replace(/(["'](?:\\.|[^\\])*?["'])|\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g, (match, quoted, variable) => {
      if (quoted !== undefined) {
        // It's already a quoted string, so return it as is.
        return quoted;
      }
      const val = this.resolveVariable(variable, context);
      const evalstring = (typeof val === 'string') ? `"${val}"` : val;
      return evalstring;
    });

    try {
      const result = eval(expr);
      return result;
    } catch (e) {
      console.error('Expression evaluation error:', expr, e);
      return false;
    }
  }
}

module.exports = {
  LexParser
};
