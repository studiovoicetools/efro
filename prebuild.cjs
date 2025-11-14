// prebuild.js
const fs = require("fs");

function writeIfDifferent(file, content) {
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) {
    fs.writeFileSync(file, content, "utf8");
  }
}

const postcss = `
// postcss.config.cjs
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`.trim() + "\n";

writeIfDifferent("./postcss.config.cjs", postcss);
console.log("Prebuild OK – postcss.config.cjs verifiziert.");
