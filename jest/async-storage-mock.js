/* eslint-env jest */
/* In-memory AsyncStorage double for Jest. Tests that need specific
 * behavior still declare their own jest.mock() factory, which takes
 * precedence over this moduleNameMapper entry. */
const memory = new Map();

module.exports = {
  __esModule: true,
  default: {
    getItem: jest.fn(async key => (memory.has(key) ? memory.get(key) : null)),
    setItem: jest.fn(async (key, value) => {
      memory.set(key, value);
    }),
    removeItem: jest.fn(async key => {
      memory.delete(key);
    }),
    getAllKeys: jest.fn(async () => [...memory.keys()]),
    multiRemove: jest.fn(async keys => {
      for (const key of keys) {
        memory.delete(key);
      }
    }),
    multiGet: jest.fn(async keys =>
      keys.map(key => [key, memory.has(key) ? memory.get(key) : null]),
    ),
    clear: jest.fn(async () => {
      memory.clear();
    }),
  },
};
