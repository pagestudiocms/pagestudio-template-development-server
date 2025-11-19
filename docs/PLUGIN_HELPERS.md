Plugin Helper API
=================

This project exposes a small helpers API to plugin/callback authors. It makes it easy to evaluate the "inner" template content of a callback block for a given local scope while deferring final variable resolution to the appropriate scope.

When a plugin is invoked as a callback block (e.g. `{{ content:entries }}...{{ /content:entries }}`), the parser calls the plugin with the following signature:

- Legacy signature: `plugin(params, context, innerParsed, data)`
- Extended signature: `plugin(params, context, innerRaw, innerParsed, data, helpers)`

If your plugin declares 6 parameters (or more), the parser will call the extended signature and provide the `helpers` object described below.

helpers API
-----------

- helpers.renderInner(localScope)
  - Purpose: parse and evaluate the inner raw template of the callback block with structural processing (conditionals, loops, nested callbacks), but leave variable tokens like `{{ title }}` intact.
  - Input: `localScope` — an object (e.g., an item from a collection) that should be used as the variable context when evaluating conditionals/loops.
  - Output: a string containing markup where structural directives have been evaluated but variable placeholders remain (e.g., `"<div>{{ title }}</div>"`).
  - Use case: call this once per item when a plugin needs to iterate a collection and run conditionals per item without resolving `{{ title }}` yet.

- helpers.resolveVariables(fragment, scope)
  - Purpose: resolve remaining `{{ var }}` placeholders in a fragment string using the provided `scope` object.
  - Input: `fragment` (string), `scope` (object)
  - Output: string with `{{ var }}` occurrences replaced by values found in `scope` (with some object handling: `body`, `html`, and `content` keys are preferred when the variable resolves to an object).
  - Use case: after calling `helpers.renderInner(item)` for each item, call `helpers.resolveVariables(fragment, item)` to replace `{{ title }}` and other variables with the per-item values.

Plugin pattern examples
-----------------------

1) Plugin that supplies its own collection:

```javascript
module.exports = (params, context, innerRaw, innerParsed, data, helpers) => {
  const collection = [ { title: 'One' }, { title: 'Two' } ];

  if (helpers && typeof helpers.renderInner === 'function') {
    return collection.map(item => {
      const fragment = helpers.renderInner(item); // conditionals evaluated
      return helpers.resolveVariables ? helpers.resolveVariables(fragment, item) : fragment;
    }).join('');
  }

  return innerParsed; // legacy fallback
};
```

2) Plugin that references a named collection in `context` via `params.collection` (plugin author should implement this lookup):

```javascript
module.exports = (params, context, innerRaw, innerParsed, data, helpers) => {
  let collection = [];
  if (params && params.collection) {
    // params.collection may be a string key or a direct array/object
    if (typeof params.collection === 'string') collection = context[params.collection] || [];
    else if (Array.isArray(params.collection)) collection = params.collection;
  }
  collection = collection.length ? collection : (context.entries || []);

  if (helpers && helpers.renderInner) {
    let out = '';
    for (const item of collection) {
      const fragment = helpers.renderInner(item);
      out += helpers.resolveVariables ? helpers.resolveVariables(fragment, item) : fragment;
    }
    return out;
  }
  return innerParsed;
};
```

Guidance and edge cases
-----------------------

- Backwards compatibility: If you don't opt-in to the extended signature, your plugin will still be called with the legacy arguments and should continue working.
- Data shape: `helpers.resolveVariables` will prefer string fields where possible (if the resolved value is an object, it prefers `body`, `html`, or `content` keys, then falls back to JSON). For predictable output, normalize your entry values to strings (e.g., store `body` as HTML string).
- Performance: `helpers.renderInner` reparses the inner template to build an AST and evaluate structural directives. If you have large collections, consider caching the parsed AST by using the raw inner template as the cache key.
- Async data: current plugin API is synchronous. If your plugin needs to fetch data asynchronously (HTTP, DB), do the fetch before returning and return the final string. If you prefer async plugin support, we can extend the parser to accept Promise-returning plugins.

If you want, I can add a short `PLUGIN_HELPERS.md` page to the main README linking to this doc, or create code examples in `examples/plugins/` to illustrate typical usage. Which would you prefer?