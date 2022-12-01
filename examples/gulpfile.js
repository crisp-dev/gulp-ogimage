var gulp = require("gulp");
var ogImage = require('../');

gulp.task("default", function(){
  return gulp.src('./index.html')
  .pipe(ogImage({
    directory : function() {
      return "./build/images"
    },

    title : function($) {
      return "title"
    }
  }))
  .pipe(gulp.dest("./build"));
});
