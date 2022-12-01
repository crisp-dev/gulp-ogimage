# gulp-ogimage

Generates Og Images automatically using Gulp

## Usage

```javascript
var gulp_og_image = require("gulp-ogimage");

var ogImage = function() {
  return gulp.src("./build/templates/*.html")
  .pipe(
    gulp_og_image({
      base : function() {
        return "https://example.com/images/og";
      },

      directory : function() {
        return "./build/images/og"
      },

      backgroundImage : function() {
      	// Optional: Add a background image
        return "./srcs/images/common/og/background.png"
      },

      title : function(file, $) {
      	// Cheerio query selector
        return $("h1").first().text();
      },

      description : function(file, $) {
      	// Cheerio query selector
        return $("p").first().text();
      }
    })
  ).pipe(
    gulp.dest(
      "./templates"
    )
  );
};

gulp.start(ogImage)
```

