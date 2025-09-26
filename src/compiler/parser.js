/**
 * Template Parser Module
 * Handles template parsing logic
 */

const path = require('path');
const { LexParser } = require('../../lib/lexParser');

class Parser {
  constructor() {
    this.lexParser = new LexParser();
  }

  /**
   * Process the template content with partials and plugins
   * @param {string} layoutContent - The raw template content
   * @param {object} context - Data context for template variables
   * @param {object} partials - Partial templates
   * @returns {string} - The processed template
   */
  processTemplate(layoutContent, context, partials) {
    let parsedContent = layoutContent;
    let partialRegex = /{{\s*template:partial\s+name="([\w-]+)"\s*}}/g;

    // Process partials first
    parsedContent = parsedContent.replace(partialRegex, (match, partialName) => {
      if (partials[partialName]) {
        // Process the partial content recursively in case it contains more partials
        return this.processTemplate(partials[partialName], context, partials);
      } else {
        console.error(`Partial "${partialName}" not found.`);
        return ''; // If partial is not found, replace with nothing
      }
    });

    let specialtyTagRegex = /<([a-z]+):([a-z]+)([^>]*)\/>/g;
    parsedContent = parsedContent.replace(specialtyTagRegex, (match, tagName, tagType, attributes) => {
      return `{{ ${tagName}:${tagType} ${attributes.trim()} }}`;
    });

    const data = {
      globalSetting: "some global value"
    };
    
    // After processing the partials, parse the content with the provided context and callbacks
    parsedContent = this.lexParser.parse(parsedContent, context, data);

    return parsedContent;
  }

  /**
   * Register a callback function with the parser
   * @param {string} name - Callback name
   * @param {function} fn - Callback function
   */
  registerFunction(name, fn) {
    this.lexParser.registerFunction(name, fn);
  }

  /**
   * Get the underlying LexParser instance
   * @returns {LexParser} - The LexParser instance
   */
  getParser() {
    return this.lexParser;
  }
}

module.exports = { Parser };