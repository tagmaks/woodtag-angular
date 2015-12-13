'use strict';
var config = require('./gulp.config')(),
    del = require('del'),
    path = require('path'),
    gulp = require('gulp'),
    tsc = require('gulp-typescript'),
    $ = require('gulp-load-plugins')({ lazy: true }),
    _ = require('lodash');


/**
 * List the available gulp tasks
 */
gulp.task('help', $.taskListing);


/**
 * Watch TypeScript and recompile
 */
gulp.task('watchTs', function () {
    gulp.watch(config.clientts, ['compileTscToJs']);
});

/**
 * Compiles *.ts files
 */
gulp.task('compileTscToJs', function () {
    log('Compiling Typescript --> Javascript');

    var tscResults = gulp.src([config.clientts, config.typings])
        .pipe(tsc({
            target: "ES5",
            removeComments: true,
            noImplicitAny: true,
            noEmitOnError: true,
            noExternalResolve: true
        }));

    return tscResults.js
        .pipe(gulp.dest(config.temp));
});

/**
 * Watch LESS and recompile the CSS
 */
gulp.task('watcherLess', function () {
    gulp.watch([config.less], ['complileLessToCss']);
});

/**
 * Compiles less to css
 * @return {Stream}
 */
gulp.task('complileLessToCss', ['cleanStyles'], function () {
    log('Compiling Less --> Css');

    return gulp
        .src(config.less)
        //.pipe($.plumber()) // exit gracefully if something fails after this
        .pipe($.less())
        //.pipe($.autoprefixer({ browsers: ['last 2 version', '> 5%'] }))
        .pipe(gulp.dest(config.temp));
});

/**
 * Wire-up bower dependencies to index.html 
 * @return {Stream}
 */
gulp.task('injectBowerDepToIndex', function () {
    log('Injecting js bower dependencies --> index.html');

    var wiredep = require('wiredep').stream;
    var options = config.getWiredepDefaultOptions();

    return gulp
        .src(config.index)
        .pipe(wiredep(options)) //inject bower dependencies to index.html
        .pipe(gulp.dest(config.client));
});

/**
 * Wire-up app js to index.html 
 * @return {Stream}
 */
gulp.task('injectAppJsToIndex', ['compileTscToJs'], function () {
    log('Injecting js app --> index.html');

    return gulp
        .src(config.index)
        .pipe(inject(config.js, '', config.jsOrder)) //inject app js to index.html
        .pipe(gulp.dest(config.client));
});

/**
 * Wire-up app css to index.html 
 * @return {Stream}
 */
gulp.task('injectAppCssToIndex', ['complileLessToCss'], function () {
    log('Wiring css up into the index.html, after files are ready');

    return gulp
        .src(config.index)
        .pipe(inject(config.css))
        .pipe(gulp.dest(config.client));
});



/**
 * Copy fonts
 * @return {Stream}
 */
gulp.task('fonts', ['cleanFonts'], function () {
    log('Copying fonts');

    return gulp
        .src(config.fonts)
        .pipe(gulp.dest(config.build + 'fonts'));
});

/**
 * Compress images
 * @return {Stream}
 */
gulp.task('images', ['cleanImages'], function () {
    log('Compressing and copying images');

    return gulp
        .src(config.images)
        //.pipe($.imagemin({ optimizationLevel: 4 }))
        .pipe(gulp.dest(config.build + 'images'));
});

/**
 * Remove all js and html from the build and temp folders
 * @param  {Function} done - callback when complete
 */
gulp.task('cleanCode', function (done) {
    var files = [].concat(
        config.temp + '**/*.js',
        config.build + 'js/**/*.js',
        config.build + '**/*.html'
    );
    clean(files, done);
});

/**
 * Remove all styles from the build and temp folders
 * @param  {Function} done - callback when complete
 */
gulp.task('cleanStyles', function (done) {
    var files = [].concat(
        config.temp + '**/*.css',
        config.build + 'styles/**/*.css'
    );
    return clean(files, done);
});

/**
 * Remove all fonts from the build folder
 * @param  {Function} done - callback when complete
 */
gulp.task('cleanFonts', function (done) {
    return clean(config.build + 'fonts/**/*.*', done);
});

/**
 * Remove all images from the build folder
 * @param  {Function} done - callback when complete
 */
gulp.task('cleanImages', function (done) {
    return clean(config.build + 'images/**/*.*', done);
});

/**
 * Optimize all files, move to a build folder,
 * and inject them into the new index.html
 * @return {Stream}
 */
gulp.task('optimize', ['injectBowerDepToIndex', 'injectAppJsToIndex', 'injectAppCssToIndex'], function () {
    log('Optimizing the js, css, and html');

    // Filters are named for the gulp-useref path
    var cssFilter = $.filter('**/*.css', {restore: true});
    var jsAppFilter = $.filter('**/' + config.optimized.app, { restore: true });
    var jslibFilter = $.filter('**/' + config.optimized.lib, { restore: true });

    return gulp
        .src(config.index)
        .pipe($.useref()) // Gather all assets from the html with useref
         //Get the css
        .pipe(cssFilter)
        .pipe($.csso())
        .pipe(cssFilter.restore)
        // Get the custom javascript
        .pipe(jsAppFilter)
        .pipe($.uglify())
        .pipe(jsAppFilter.restore)
        // Get the vendor javascript
        .pipe(jslibFilter)
        .pipe($.uglify()) // another option is to override wiredep to use min files
        .pipe(jslibFilter.restore)
        //// Take inventory of the file names for future rev numbers
        //.pipe($.rev())
        // Apply the concat and file replacement with useref
        //.pipe(assets.restore)
        .pipe($.useref())
        //// Replace the file names in the html with rev numbers
        //.pipe($.revReplace())
        .pipe(gulp.dest(config.build));
});

/**
 * Build everything
 * This is separate so we can run tests on
 * optimize before handling image or fonts
 */
gulp.task('build', ['images', 'fonts', 'optimize'], function () {
    log('Building everything');

    var msg = {
        title: 'gulp build',
        subtitle: 'Deployed to the build folder',
        message: 'Running `gulp serve-build`'
    };
    del(config.temp);
    log(msg);
    notify(msg);
});

/**
 * Inject files in a sorted sequence at a specified inject label
 * @param   {Array} src   glob pattern for source files
 * @param   {String} label   The label name
 * @param   {Array} order   glob pattern for sort order of the files
 * @returns {Stream}   The stream
 */
function inject(src, label, order) {
    var options = {
        read: false,
        relative: true
    };
    if (label) {
        options.name = 'inject:' + label;
    }

    return $.inject(orderSrc(src, order), options);
}

/**
 * Order a stream
 * @param   {Stream} src   The gulp.src stream
 * @param   {Array} order Glob array pattern
 * @returns {Stream} The ordered stream
 */
function orderSrc(src, order) {
    //order = order || ['**/*'];
    return gulp
        .src(src)
        .pipe($.if(order, $.order(order)));
}

/**
 * Log a message or series of messages using chalk's blue color.
 * Can pass in a string, object or array.
 */
function log(msg) {
    if (typeof (msg) === 'object') {
        for (var item in msg) {
            if (msg.hasOwnProperty(item)) {
                $.util.log($.util.colors.blue(msg[item]));
            }
        }
    } else {
        $.util.log($.util.colors.blue(msg));
    }
}

/**
 * Delete all files in a given path
 * @param  {Array}   path - array of paths to delete
 * @param  {Function} done - callback when complete
 */
function clean(path, done) {
    log('Cleaning: ' + $.util.colors.blue(path));
    return del(path, done);
}

/**
 * Show OS level notification using node-notifier
 */
function notify(options) {
    var notifier = require('node-notifier');
    var notifyOptions = {
        sound: 'Bottle',
        contentImage: path.join(__dirname, 'gulp.png'),
        icon: path.join(__dirname, 'gulp.png')
    };
    _.assign(notifyOptions, options);
    notifier.notify(notifyOptions);
}