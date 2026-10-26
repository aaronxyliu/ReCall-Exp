// Build-only offline Google Fonts fixture. No application JS is changed.
module.exports = new Proxy({}, { get: () => '/* offline font stylesheet: no network font assets */' });
