
const webpackConfig = require('./webpack.config.js');

module.exports = function (grunt) {
  grunt.initConfig({
    watch: {
      js: {
        files: [
          'src/js/**/*.js',
        ],
        tasks: ['webpack'],
      },
      scss: {
        files: [
          'src/scss/**/*.scss',
        ],
        tasks: ['webpack'],
      },
    },
    webpack: {
      default: webpackConfig,
    },
  });
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-webpack');
}