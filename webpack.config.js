const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    main: {
      import: "./example/js/main.js",
      filename: "main.js"
    },
    style: "./example/scss/style.scss"
  },
  output: {
    path: path.resolve(__dirname, 'compiled/assets/js/'),
    filename: '[name].js'
  },
  target: ['web', 'es6'],
  externals: {
    lodash: "lodash"
  },
  mode: 'development',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.scss$/, // Match SCSS files
        use: [
          MiniCssExtractPlugin.loader, // Extract CSS to a file
          {
            loader: 'css-loader',    // Translates CSS into CommonJS
            options: {
              url: false,
            }
          },
          {
            loader: 'sass-loader',     // Compiles SCSS to CSS
            options: {
              sourceMap: true,        // Enable SCSS source maps
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '../css/[name].css', // Output CSS files in build/assets/css
    })
  ]
};