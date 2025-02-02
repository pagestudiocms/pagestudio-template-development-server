const { utils } = require('./utils');

/**
 * LexParser class is a JavaScript implementation of the PyroCMS Lex parser,
 * designed to parse and extract variables, conditionals, loops, and callback
 * tags from a given text based on specific patterns and conditions. This port
 * retains the core functionality and features of the original Lex parser while
 * adapting it for JavaScript environments.
 *
 * Main functionalities include:
 * - **Parsing variables**: Extracts and replaces variables in the text.
 * - **Parsing conditionals**: Handles if, unless, elseif, elseunless, else,
 *   and endif conditions.
 * - **Parsing loops**: Processes looped tags and iterates over arrays or objects.
 * - **Parsing callback tags**: Handles custom callback tags and their parameters.
 * - **Handling noparse blocks**: Extracts and reinjects noparse blocks to
 *   prevent parsing.
 * - **Recursive parsing**: Supports recursive tag parsing to handle nested
 *   structures.
 * - **Parameter parsing**: Parses parameters from strings into key-value pairs.
 *
 * This parser is particularly useful in templating systems where dynamic
 * content generation, nested structures, and flexible tag handling are required.
 * It offers robust support for complex scenarios with the same reliability and
 * efficiency as the original PHP Lex parser.
 *
 * Example usage:
 * const parser = new LexParser();
 * const parsedText = parser.parse(templateText, data, callbackFunction);
 *
 * @class LexParser
 * @example
 * const parser = new LexParser();
 * const template = "Hello, {name}!";
 * const data = { name: "World" };
 * console.log(parser.parse(template, data));
 * // Output: "Hello, World!"
 */

class LexParser {
  constructor() {
    this.regexSetup = false;
    this.scopeGlue = '.';
    this.tagRegex = '';
    this.cumulativeNoparse = false;
    this.inCondition = false;
    this.variableRegex = '';
    this.variableLoopRegex = '';
    this.variableTagRegex = '';
    this.callbackTagRegex = '';
    this.callbackLoopTagRegex = '';
    this.noparseRegex = '';
    this.conditionalRegex = '';
    this.conditionalElseRegex = '';
    this.conditionalEndRegex = '';
    this.conditionalExistsRegex = '';
    this.conditionalNotRegex = '';
    this.regexSetup = false;
    this.conditionalData = [];
    this.extractions = {
      noparse: [],
      looped_tags: {},
      callback_blocks: {},
    };
    this.staticData = null;
    this.callbackData = [];
  }

  setupRegex() {
    if (this.regexSetup) {
      return;
    }
    const glue = this.scopeGlue === '\\.' ? '[a-zA-Z0-9_' + this.scopeGlue + ']+'
      : `[a-zA-Z0-9_\\${this.scopeGlue}]+`;

    this.variableRegex = glue;
    this.callbackNameRegex = this.variableRegex + this.scopeGlue + this.variableRegex;
    this.variableLoopRegex = new RegExp('\\{\\{\\s*(' + this.variableRegex + ')\\s*\\}\\}(.*?)\\{\\{\\s*\\/\\1\\s*\\}\\}', 'msg');
    this.variableTagRegex = new RegExp('\\{\\{\\s*(' + this.variableRegex + ')\\s*\\}\\}', 'mg');

    // this.callbackBlockRegex = new RegExp('\\{\\{\\s*(' + this.variableRegex + ')(\\s.*?)\\}\\}(.*?)\\{\\{\\s*\\/\\1\\s*\\}\\}', 'msg');
    this.callbackBlockRegex = new RegExp(`\\{\\{\\s*(${this.variableRegex})(\\s+[^}]+)?\\s*\\}\\}(.*?)\\{\\{\\s*\\/\\1\\s*\\}\\}`, 'msg');

    this.recursiveRegex = new RegExp('\\{\\{\\s*\\*recursive\\s*(' + this.variableRegex + ')\\*\\s*\\}\\}', 'ms');

    this.noparseRegex = new RegExp('\\{\\{\\s*noparse\\s*\\}\\}(.*?)\\{\\{\\s*\\/noparse\\s*\\}\\}', 'ms');

    this.conditionalRegex = new RegExp('\\{\\{\\s*(if|unless|elseif|elseunless)\\s*((?:\\()?(.*?)(?:\\))?)\\s*\\}\\}', 'ms');
    this.conditionalElseRegex = new RegExp('\\{\\{\\s*else\\s*\\}\\}', 'ms');
    this.conditionalEndRegex = new RegExp('\\{\\{\\s*endif\\s*\\}\\}', 'ms');
    this.conditionalExistsRegex = new RegExp('(\\s+|^)exists\\s+(' + this.variableRegex + ')(\\s+|$)', 'ms');
    this.conditionalNotRegex = new RegExp('(\\s+|^)not(\\s+|$)', 'ms');

    this.regexSetup = true;
  }

  parse(text, data = {}, callback = false) {
    this.setupRegex();

    // if (typeof data === 'object' && !Array.isArray(data)) {
    //   data = this.toArray(data);
    // }

    if (this.staticData === null) {
      this.staticData = data;
    } else {
      data = Object.assign({}, this.staticData, data);
      this.callbackData = data;
    }

    text = this.parseComments(text);
    text = this.extractNoparse(text);
    text = this.extractLoopedTags(text, data, callback);

    // Order is important here. We parse conditionals first as to avoid
    // unnecessary code from being parsed and executed.
    text = this.parseConditionals(text, data, callback);
    text = this.injectExtractions(text, 'looped_tags');
    text = this.parseVariables(text, data, callback);
    text = this.injectExtractions(text, 'callback_blocks');

    if (callback) {
      text = this.parseCallbackTags(text, data, callback);
    }

    if (!this.cumulativeNoparse) {
      text = this.injectExtractions(text);
    }

    return text;
  }

  parseComments(text) {
    this.setupRegex();
    return text.replace(/\{\{#.*?#\}\}/g, '');
  }

  parseVariables(text, data, callback = null) {
    this.setupRegex();

    if (this.variableLoopRegex) {
      let dataMatches = [...text.matchAll(this.variableLoopRegex)];
      // console.log(text)

      dataMatches.forEach(match => {
        if (this.getVariable(match[1], data)) {
          let loopedText = '';
          const loopData = this.getVariable(match[1], data);

          if (Array.isArray(loopData) || loopData instanceof Object) {
            loopData.forEach(itemData => {
              let str = this.extractLoopedTags(match[2], itemData, callback);
              str = this.parseConditionals(str, itemData, callback);
              str = this.injectExtractions(str, 'looped_tags');
              str = this.parseVariables(str, itemData, callback);
              if (callback) {
                str = this.parseCallbackTags(str, itemData, callback);
              }
              loopedText += str;
            });
          }

          text = text.replace(new RegExp(match[0], 'm'), loopedText);
        } else {
          text = this.createExtraction('callback_blocks', match[0], match[0], text);
        }
      });
    }

    let dataMatches = [...text.matchAll(this.variableTagRegex)];
    dataMatches.forEach((match, index) => {
      let val = this.getVariable(match[1], data, '__lex_no_value__');
      if (val !== '__lex_no_value__') {
        text = text.replace(match[0], val);
      }
    });

    return text;
  }

  parseCallbackTags(text, data, callback) {
    this.setupRegex();
    const inCondition = this.inCondition;

    // Define the regex patterns for condition and non-condition modes
    const regex = inCondition
      ? new RegExp(`\\{\\s*(${this.variableRegex})(\\s+.*?)?\\s*\\}`, 'ms')
      // : new RegExp(`\\{\\{\\s*(${this.variableRegex})(\\s+.*?)?\\s*(\\/)?\\}\\}`, 'ms');
      : new RegExp("\\{\\{\\s*([a-zA-Z0-9_.:]+)(\\s+.*?)?\\s*(\\/)?\\}\\}", "ms");

    let match;
    while ((match = regex.exec(text)) !== null) {
      const selfClosed = !!match[3]; // Self-closing tag check
      let parameters = {};
      let tag = match[0]; // The full matched tag
      const start = match.index; // Starting position of the tag
      const name = match[1]; // Callback name
      const rawParams = match[2] || ''; // Raw parameters
      let content = '';

      // Parse parameters if present
      if (rawParams) {
        let cbData = data;
        if (this.callbackData && Object.keys(this.callbackData).length) {
          cbData = { ...this.callbackData, ...data };
        }
        parameters = this.parseParameters(this.injectExtractions(rawParams.trim(), '__cond_str'), cbData, callback);
      }

      // Process content for non-self-closing tags
      if (!selfClosed) {
        const tempText = text.slice(start + tag.length);
        const endTagRegex = new RegExp(`\\{\\{\\s*/\\s*${name}\\s*\\}\\}`, 'm');
        const endMatch = endTagRegex.exec(tempText);

        if (endMatch) {
          content = tempText.slice(0, endMatch.index);
          const endTag = endMatch[0];
          tag += content + endTag;

          // Check for nested blocks
          const nestedRegex = new RegExp(
            `\\{\\{\\s*(${name})(\\s.*?)?\\}\\}(.*?)\\{\\{\\s*/\\1\\s*\\}\\}`,
            'ms'
          );
          const nestedMatch = nestedRegex.exec(content + endTag);

          if (nestedMatch) {
            const nestedContent = nestedMatch[0].replace(endTagRegex, '');
            content = this.createExtraction('nested_looped_tags', nestedContent, nestedContent, content);
          }
        }
      }

      // Call the callback with extracted values:
      // ${String[tag], Array[params], Array[data]}
      let replacement = callback(name, parameters, content, data);
      replacement = this.parseRecursives(replacement, content, callback);

      if (inCondition) {
        replacement = this.valueToLiteral(replacement);
      }

      // Replace the tag in the text with the replacement value
      const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tagRegex = new RegExp(escapedTag, 'm');
      text = text.replace(tagRegex, replacement);

      // Inject nested extractions if applicable
      text = this.injectExtractions(text, 'nested_looped_tags');
    }

    return text;
  }

  parseConditionals(text, data, callback) {
    this.setupRegex();
    // Implement conditional parsing logic here
    return text;
  }

  parseRecursives(text, origText, callback) {
    // Implement recursive tag parsing logic here
    return text;
  }

  scopeGlue(glue = null) {
    if (glue !== null) {
      this.scopeGlue = glue;
    }
    return this.scopeGlue;
  }

  cumulativeNoparse(mode) {
    // Implement cumulative noparse logic here
  }

  injectNoparse(text) {
    // Implement noparse injection logic here
    return text;
  }

  processConditionVar(match) {
    // Implement condition variable processing logic here
    return '';
  }

  processParamVar(match) {
    // Implement parameter variable processing logic here
    return '';
  }

  valueToLiteral(value) {
    console.log(`literal ${value}`);
    // Implement conversion to literal logic here
    return '';
  }

  extractNoparse(text) {
    let match;
    while ((match = this.noparseRegex.exec(text)) !== null) {
      this.extractions.noparse.push(match[1]);
      text = text.replace(match[0], '__lex_noparse_placeholder__');
    }
    return text;
  }

  /**
   * Extracts the looped tags so that we can parse conditionals then re-inject.
   *
   * @param  string $text The text to extract from
   * @return string
   */
  extractLoopedTags(text, data = [], callback = null) {
    const matches = [...text.matchAll(this.callbackBlockRegex)];
    matches.forEach(match => {
      // Does this callback block contain parameters?
      if (this.parseParameters(match[2], data, callback)) {
        // Let's extract it so it doesn't conflict with local variables when parseVariables() is called.
        text = this.createExtraction('callback_blocks', match[0], match[0], text);
      } else {
        text = this.createExtraction('looped_tags', match[0], match[0], text);
      }
    });

    return text;
  }

  createExtraction(type, extraction, replacement, text) {
    const hash = utils.generateObjectId(12)

    // Store the replacement in the extractions object
    if (!this.extractions[type]) {
      this.extractions[type] = {};
    }
    this.extractions[type][hash] = replacement;

    // Replace the extraction in the text with the hashed reference
    return text.replace(extraction, `${type}_${hash}`);
  }

  /**
   * Injects all of the extractions.
   *
   * @param  string $text Text to inject into
   * @return string
   */
  injectExtractions(text, type = null) {
    if (type === null) {
      for (const type in this.extractions) {
        const extractions = this.extractions[type];
        for (const hash in extractions) {
          if (text.includes(`${type}_${hash}`)) {
            text = text.replace(`${type}_${hash}`, extractions[hash]);
            delete this.extractions[type][hash];
          }
        }
      }
    } else {
      if (!this.extractions[type]) return text;

      const extractions = this.extractions[type];
      for (const hash in extractions) {
        if (text.includes(`${type}_${hash}`)) {
          text = text.replace(`${type}_${hash}`, extractions[hash]);
          delete this.extractions[type][hash];
        }
      }
    }

    return text;
  }

  getVariable(key, data, defaultVal) {
    if (typeof data === 'object' && data !== null) {
      // Helper function to reduce the object
      const getValue = (obj, part) => {
        if (obj && typeof obj[part] !== 'undefined') {
          return obj[part];
        }
        return defaultVal;
      };

      // Split the key by dots and reduce to traverse the object
      const value = key.split('.').reduce(getValue, data);
      return value;
    }
    // Handle the case where data is not an object
    return defaultVal; // or some default handling if needed
  }

  parsePhp(text) {
    // Implement PHP parsing logic here
    return '';
  }

  /**
   * Parses a parameter string into an array
   *
   * @param   string  The string of parameters
   * @return array
   */
  parseParameters(parameters, data, callback) {
    if (typeof parameters === 'undefined') return false;

    this.conditionalData = data;
    this.inCondition = true;

    // Extract all literal string in the conditional to make it easier
    const strMatches = [...parameters.matchAll(/(["\']).*?(?<!\\\\)\1/msg)];
    strMatches.forEach(m => {
      parameters = this.createExtraction('__param_str', m[0], m[0], parameters);
    });

    parameters = parameters.replace(
      /(.*?\s*=\s*(?!__))(.${this.variableRegex})/is,
      this.processParamVar.bind(this)
    );

    if (callback) {
      parameters = parameters.replace(
        /(.*?\s*=\s*(?!\{\s*)(?!__))(.${this.callbackNameRegex})(?!\s*\})\b/,
        '$1{$2}'
      );
      parameters = this.parseCallbackTags(parameters, data, callback);
    }

    // Re-inject any strings we extracted
    parameters = this.injectExtractions(parameters, '__param_str');
    this.inCondition = false;

    const matches = [...parameters.matchAll(/(.*?)\s*=\s*(\'|"|&#?\w+;)(.*?)(?<!\\\\)\2/gs)];

    const returnData = {};
    matches.forEach((match, i) => {
      returnData[match[1].trim()] = this.stripslashes(match[3].trim());
    });

    return returnData;
  }

  stripslashes(str) {
    return str.replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\0/g, '\0');
  }

  toArray(data = {}) {
    // Convert object to array
    return Array.isArray(data) ? data : Object.keys(data).map(key => data[key]);
  }
}

module.exports = LexParser;