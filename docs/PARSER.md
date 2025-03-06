### Key Concepts:

1. **Single Variables**: 
   - Variables that refer to a key or nested keys in the context object (e.g., `{{ name }}`, `{{ address.street }}`).
   - These can also support callbacks (e.g., `{{ username format="lowercase" }}`), where the callback applies to the variable's value.
  
2. **Looped Variables (Arrays)**: 
   - Variables representing arrays where each item can be iterated over (e.g., `{{ users }} ... {{ /users }}`).
   - These also support callbacks (e.g., `{{ users format="uppercase" }}...{{ /users }}`).

3. **Plugin Tags**: 
   - Special tags that can have both an opening and closing tag, as well as attributes and inner content. For example, `{{ plugin:name param1="value1" param2="value2" }}` or `{{ plugin:name param1="value1" param2="value2" }} ... {{ /plugin:name }}`.
   - The opening tag triggers the plugin logic, while the closing tag signals the end of the plugin’s content.

4. **Callbacks**: 
   - Functions that modify or format variable values before they’re injected into the template. These can be used inside variables, looped variables, or even plugin content.
   - Callbacks are dynamically registered by the user (e.g., `format="lowercase"` would map to a callback that converts text to lowercase).

### High-Level Design:

#### 1. **Single Variable Processing**:
   - The parser scans the template for tags like `{{ var }}` and replaces them with the corresponding value from the context object.
   - It also checks if the variable tag has any callback (e.g., `{{ username format="lowercase" }}`), which will be executed on the value before it's inserted.

#### 2. **Looped Variable Processing**:
   - For tags like `{{ users }} ... {{ /users }}`, the parser should loop over the array defined in the context for `users` and apply the template content for each item.
   - Inside the loop, it should process variables for each item (e.g., `{{ name }}` for each user in `users`).
   - The loop should also allow for callbacks on array items (e.g., `{{ users format="uppercase" }}`), where the callback is applied to each item in the loop.

#### 3. **Plugin Tag Handling**:
   - The parser recognizes plugin tags like `{{ plugin:name param1="value1" param2="value2" }}` and processes them using a registered plugin callback.
   - The parser handles both opening (`{{ plugin:name ... }}`) and closing tags (`{{ /plugin:name }}`).
   - The content inside the plugin tags (if any) should be passed to the plugin callback for further processing.

#### 4. **Callback Handling**:
   - Callbacks can be applied to variables, array items, or plugin content. 
   - Each callback should be registered by name (e.g., `format` for formatting text, `uppercase` for converting text to uppercase).
   - The callback modifies the value at runtime when the template is processed.

### Flow of Operations:

1. **Identify Tag Type**:
   - The parser needs to first identify the type of tag (variable, looped variable, or plugin tag).
   - For each tag type, it must check if there are any associated callbacks.

2. **Process Single Variables**:
   - For single variables, the parser will replace the tag with the value from the context and apply any callbacks to the value (if present).

3. **Process Loops**:
   - For array-based tags (e.g., `{{ users }}`), the parser will loop over the items in the array, process any internal tags or callbacks, and replace the looped content with the processed output.

4. **Process Plugin Tags**:
   - For plugin tags, the parser should identify the opening and closing tags, extract the parameters, and call the appropriate plugin logic.
   - The content between the opening and closing plugin tags should be passed to the plugin callback for processing.

5. **Apply Callbacks**:
   - For any tag that includes a callback (e.g., `{{ username format="lowercase" }}`), the callback is applied to the corresponding variable, loop item, or plugin content.
   - Callbacks can be applied on-the-fly and dynamically as the parser processes the template.

### Example:

#### Template:

```html
<h1>{{ site.title }}</h1>
{{ users }}
    <p>{{ name format="uppercase" }}</p>
{{ /users }}
{{ plugin:email param="someValue" }}
    <p>{{ email }}</p>
{{ /plugin:email }}
```

#### Context:

```json
{
  "site": { "title": "My Website" },
  "users": [
    { "name": "John Doe", "email": "john@example.com" },
    { "name": "Jane Smith", "email": "jane@example.com" }
  ]
}
```

#### Expected Flow:

1. **`{{ site.title }}`** is replaced with "My Website".
2. **`{{ users }}`** initiates a loop over the `users` array.
   - Inside the loop, **`{{ name format="uppercase" }}`** applies the `uppercase` callback to the `name` of each user (e.g., "John Doe" becomes "JOHN DOE").
3. **`{{ plugin:email param="someValue" }}`** triggers the `email` plugin with the provided parameters (`param="someValue"`), and the email content is processed and inserted.
4. The final output will contain the processed values with the appropriate transformations applied by the callbacks.

### Conclusion:

- The parser should handle all the mentioned tag types, process any variables (including nested ones), loop over arrays, handle plugin tags, and support dynamic callbacks for modifying values.
- The flow of processing should involve first identifying the type of tag, applying any callbacks, and then replacing the tag with the processed value.
