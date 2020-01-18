/*!
 *
 * Development Server 
 *
 */

"use strict";

module.exports = {
  circularReplacer: () => {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }
      return value;
    };
  }
};