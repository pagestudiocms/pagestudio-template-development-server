/**
 * Generates a 24 character hexadecimal string
 * 
 * A JavaScript function that generates a string similar to the ObjectId used in MongoDB:
 *  - 4-byte timestamp representing the creation time of the document.
 *  - 5-byte random value.
 *  - 3-byte incrementing counter, initialized to a random value.
 *
 * @param {number} length Defaults to 24
 * @returns {string} A 24 character hexadecimal string
 */
const generateObjectId = (length = 24) => {
  // Generate timestamp (4 bytes)
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');

  // Generate random value (5 bytes)
  let random = '';
  for (let i = 0; i < 5; i++) {
    random += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }

  // Generate incrementing counter (3 bytes)
  const counter = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');

  // Combine all parts and return the object ID
  const objectId = timestamp + random + counter;
  return objectId.substring(0, length); // Ensure the ID is exactly the specified length
}

module.exports = {
  utils: {
    generateObjectId: generateObjectId,
  }
}