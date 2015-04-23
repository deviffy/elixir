var gulp = require('gulp');
var elixir = require('laravel-elixir');
var config = elixir.config;
var inSequence = require('run-sequence');
var utilities = require('./commands/Utilities');
var notifications = require('./commands/Notification');
var gulpIf = require('gulp-if');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var watchify = require('watchify');
var _  = require('underscore');

/**
 * Create the Gulp task.
 *
 * @return {void}
 */
var buildTask = function() {
    var stream;

    gulp.task('browserify', function() {
        var onError = function(e) {
            new notifications().error(e, 'Browserify Compilation Failed!');
            this.emit('end');
        };

        var bundle = function(b, instance) {
            return b.bundle()
                .on('error', onError)
                .pipe(source(instance.src.split("/").pop()))
                .pipe(buffer())
                .pipe(gulpIf(!instance.options.debug, uglify()))
                .pipe(gulpIf(typeof instance.options.rename === 'string', rename(instance.options.rename)))
                .pipe(gulp.dest(instance.options.output))
                .pipe(new notifications().message('Browserified!'));
        };

        config.toBrowserify.forEach(function(instance) {
            var b = browserify(instance.src, instance.options);

            if (config.watchify) {
                b = watchify(b);

                b.on('update', function() {
                    bundle(b, instance);
                });
            }

            stream = bundle(b, instance);
        });

        return stream;
    });
};

/**
 * Create elixir extension
 */
elixir.extend('browserify', function (src, options) {
    if (!_.isArray(config.toBrowserify)) {
        config.toBrowserify = [];
    }

    options = _.extend({
        debug:         ! config.production,
        rename:        null,
        srcDir:        config.assetsDir + 'js',
        output:        config.jsOutput,
        transform:     [],
        insertGlobals: false
    }, options);

    config.toBrowserify.push({
        src : "./" + utilities.buildGulpSrc(src, options.srcDir),
        options: options
    });

    buildTask();

    this.registerWatcher('browserify', options.srcDir + '/**/*.js', config.watchify ? 'nowatch' : 'default');

    return this.queueTask('browserify');
});

/**
 * Create elixir extension for Watchify command
 */
elixir.extend('watchify', function() {
    var config = this;

    gulp.task('watchify', ['watch'], function() {
        config.watchify = true;

        inSequence.apply(this, ['browserify']);
    });

    return this.queueTask('watchify');
});
