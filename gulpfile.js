/**
 * Created by Sergey on 1/1/15.
 */
var gulp = require('gulp');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename')

gulp.task('default', function(cb) {

	gulp.src([
		"./angular-s3.js"
	])
		.pipe(uglify())
		.pipe(rename('angular-s3.min.js'))
		.pipe(gulp.dest('./'));
});