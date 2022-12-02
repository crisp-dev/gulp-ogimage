var gulp = require("gulp");
var ogImage = require('../');

gulp.task("default", function(){
  return gulp.src('./index.html')
  .pipe(ogImage({
    base : function() {
      return "https://example.com/"
    },
    directory : function() {
      return "./build/images"
    }
  }))
  .pipe(gulp.dest("./build"));
});
