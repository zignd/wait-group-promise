module.exports = {
  "env": {
    "es6": true,
    "node": true
  },
  "parserOptions": {
    "ecmaVersion": 8,
  },
  "extends": "eslint:recommended",
  "rules": {
    "indent": [
      "error",
      2, { "SwitchCase": 1 }
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "single"
    ],
    "semi": [
      "error",
      "always"
    ],
    "prefer-const": ["error", {
      "destructuring": "any",
      "ignoreReadBeforeAssign": false
    }],
    "comma-dangle": ["error", "never"],
    "strict": ["error", "global"],
    "no-console": ["error", { allow: ["dir", "error", "log"] }],
    "no-constant-condition": ["error", { "checkLoops": false }],
    "no-unused-vars": ["error", { "args": "none" }],
    "no-case-declarations": "off",
    "arrow-parens": ["error", "always"]
  }
};