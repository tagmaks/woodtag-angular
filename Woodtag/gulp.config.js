module.exports = function () {

  // Used to configure wiredep
  var bower = {
    json: require('./bower.json'),
    directory: './bower_components/',
    ignorePath: '../..'
  };

  var client = './client/';
  var root = './';
  var temp = './.tmp/';

  var config = {
    /**
     * File paths
     */

    //bower: bower,
    build: './build/',
    client: client,
    css: temp + 'styles.css',
    index: client + 'index.html',
    less: client + 'styles/styles.less',
    images: client + 'images/**/*.*',
    fonts: bower.directory + 'font-awesome/fonts/**/*.*',

    /**
     * Optimized files
     */
    optimized: {
      app: 'app.js',
      lib: 'lib.js'
    },

    /**
     * Bower and NPM files
     */
    bower: bower,
    packages: [
        './package.json',
        './bower.json'
    ],

    // Typescript settings
    clientts: './client/**/*.ts',
    typings: './typings/**/*.d.ts',

    // app js
    js: [
        temp + '**/*.js'
    ],
    jsOrder: [
        '**/*.js'
    ],

    temp: temp,

  }

  /**
   * wiredep and bower settings
   */
  config.getWiredepDefaultOptions = function () {
    var options = {
      bowerJson: config.bower.json,
      directory: config.bower.directory,
      ignorePath: config.bower.ignorePath
    };
    return options;
  };

  return config;
}