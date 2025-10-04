/**
 * Content entries plugin
 * Renders a content entry with the provided parameters
 */

module.exports = (params, context, innerRaw, innerParsed, data, helpers) => {
  // entries should be passed in context or params.collection
  const { entries, ...pageData } = context;
  const collection = entries || [];

  // If helpers.renderInner is available, use it to render each item's inner template
  if (helpers && typeof helpers.renderInner === 'function') {
    let out = '';
    for (const entry of collection) {
      const entryData = { ...pageData, ...entry };
      /**
       * helpers.renderInner should evaluate conditionals/loops 
       * and return text with variables intact
       */
      const fragment = helpers.renderInner(entryData);
      // out+= fragment;
      if (helpers.resolveVariables) {
        out += helpers.resolveVariables(fragment, entryData);
      } else {
        out += fragment;
      }
    }
    return out;
  }

  // Fallback: when helpers are not provided, assume innerParsed is already rendered with full resolution
  // (legacy behaviour)
  return innerParsed;
};