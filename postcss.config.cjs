// postcss.config.cjs – kompatibel mit Tailwind 3 + Next 14
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('autoprefixer'),
  ],
};
