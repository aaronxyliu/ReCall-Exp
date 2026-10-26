# Student Guide: Web-Library Function Recovery Ground Truth

**Goal:** Select ten popular libraries from CDNJS, bundle them with webpack, use **source maps** to pair original and bundled functions, save the pairs in a database, and publish all research artifacts on GitHub.

For example, a function may be renamed and minified inside the bundle:

```javascript
// Original: library.js
function add(para1, para2) { return para1 + para2; }

// Bundled: bundle.js (excerpt)
function n(t,r){return t+r}
```

Use the bundle's source map to establish the pair `library.js:add ↔ bundle.js:n`, and store both functions' exact locations (file name + line number + column number) in the database.

**FOLLOWING IS A POSSIBLE WORKFLOW:**

## 1. Select ten libraries

- Use the latest available ranking report from [CDNJS usage statistics](https://github.com/cdnjs/cf-stats). Select top 10 most-popular libraries. Exclude CSS/font-only entries and deduplicate aliases. 
- For each library, choose its latest version in those rows. Use [CDNJS](https://cdnjs.com/) to fetch the url of these libraries.


## 2. Bundle each library with webpack

- Build a crafted web application, which load these web libraries.
- Use [Webpack](https://www.webpackjs.com/) to build bundle the whole application. Below is an example bundle config setting:

```javascript
{
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimize: true,
    usedExports: false,
    sideEffects: false,
    concatenateModules: false
  }
}
```

- Save every emitted JavaScript file, its `.map`, the webpack configuration, build command/log, module statistics, etc..

## 3. Extract source and bundled functions

- Parse the exact webpack input files and generated JavaScript with an AST(Abstract Syntax Tree) parser.
- Include declarations, expressions, arrows, methods, anonymous callbacks, and nested functions.
- Assign each function definition an ID based on file identity and location. 
- Keep target-library functions separate from dependencies, fixture code, and webpack runtime code.

## 4. Build ground-truth pairs using source maps
Try by yourself.

## 5. Save and validate the database

Use MySQL and publish its schema. You may include these tables:

| Table | Essential content |
|---|---|
| `libraries` | Name, version, ranking and acquisition information |
| `builds` | Library, profile, configuration, tool versions, artifact hashes |
| `functions` | Source/bundled stage, build/file identity, function ID and exact span |
| `pairs` | Source ID, bundled ID, build ID, status, source-map evidence reference |


Enable foreign keys and prevent duplicate pair rows. 

## 6. Upload and document everything on GitHub



