/* prebuild.js: prüft CSS-Toolchain für Render */
import fs from "fs";

function writeIfChanged(path, content) {
  if (!fs.existsSync(path) || fs.readFileSync(path, "utf8") !== content) {
    fs.writeFileSync(path, content, "utf8");
  }
}

const postcssCfg = `// postcss.config.cjs
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

writeIfChanged("./postcss.config.cjs", postcssCfg);

console.log("✅ Prebuild: postcss.config.cjs überprüft.");
