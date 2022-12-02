'use strict';

const through     = require("through2");
const Canvas      = require("canvas");
const Path        = require("path");
const cheerio     = require("cheerio");
const fs          = require("fs");
const emojiRegex  = require("emoji-regex");


const BACKGROUND_CACHE = {};

const OG_IMAGE_REGEX    = /<meta\s*property="og:image"\s*content="([A-Za-z0-9;:\/?.]*)"\s*\/?>/;
const TWITTER_SRC_REGEX = /<meta\s*name="twitter:image:src"\s*content="([A-Za-z0-9;:\/?.]*)"\s*\/?>/;
const EMOJI_REGEX       = emojiRegex();
Canvas.registerFont(__dirname + "/res/opensans_regular.ttf", {
  family: "Open Sans",
  weight: "regular"
});

Canvas.registerFont(__dirname + "/res/opensans_bold.ttf", {
  family: "Open Sans",
  weight: "bold"
});

var add_og_image_to_html = (file, buffer, options) => {
  let $ = cheerio.load(buffer.toString());

  let _title       = "";
  let _description = "";
  let _directory   = options.directory(file);
  let _name        = Path.parse(file.path).name;

  if (options.name) {
    _name = options.name(file);
  }

  if (options.title) {
    _title = options.title(file, $);
  } else {
    _title = extract_title(file, $);
  }

  if (options.description) {
    _description = options.description(file, $);
  } else {
    _description = extract_description(file, $);
  }

   // Remove Emojis as those are unsupported
  if (_title) {
    _title = _title.replace(EMOJI_REGEX, "");
    _title = _title.trim();
  }

  if (_description) {
    _description = _description.replace(EMOJI_REGEX, "");
    _description = _description.trim();
  }

  return Promise.resolve()
    .then(() => {
      return assert_path(_directory);
    })
    .then(() => {
      return load_image(file, options)
    })
    .then((backgroundImage) => {
      return build_og_image({
        name: _name,
        title: _title,
        description: _description,
        directory: _directory,
        backgroundImage: backgroundImage
      });
    })
    .then(() => {
      return Promise.resolve(
        replace_og_image(buffer, {
          name: _name,
          base: options.base,
          file: file
        })
      );
    })
};

var extract_title = (_, cheerio_instance) => {
  return cheerio_instance("title").text();
};

var extract_description = (_, cheerio_instance) => {
  return cheerio_instance("meta[name='description']").attr("content");
};

var load_image = function(file, options) {
  if (!options.backgroundImage) {
    return Promise.resolve(null);
  }

  let _path = options.backgroundImage(file);

  if (BACKGROUND_CACHE[_path]) {
    return Promise.resolve(BACKGROUND_CACHE[_path]);
  }

  return Canvas.loadImage(_path).then((image) => {
    BACKGROUND_CACHE[_path] = image;

    return Promise.resolve(image);
  });
};

var assert_path = (outputPath) => {
  return new Promise((resolve, reject) => {
    fs.exists(outputPath, (exists) => {
      if (exists === true) {
        return resolve();
      }

      fs.mkdir(outputPath, { recursive: true }, (err) => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    })
  })
};

var build_og_image = (parameters) => {
  let _width        = 1200;
  let _height       = 620;
  let _max_width    = 700;

  let _canvas       = Canvas.createCanvas(_width, _height);
  let _context      = _canvas.getContext("2d");

  _context.fillStyle  = "#FFFFFF";
  _context.fillRect(0, 0, _width, _height);

  _context.textAlign    = "left";
  _context.textBaseline = "top";
  _context.fillStyle    = "#101010";

  _context.font         = "bold 30pt Open Sans";

  _context.fillStyle    = "#3E464E";

  let _y = 240;

  if (parameters.backgroundImage) {
    _context.drawImage(parameters.backgroundImage, 0, 0);
  }

  if (parameters.title) {
    _y = __wrap_text(
      _context, parameters.title, 86 , _y, _max_width, 40
    );
  }

  _context.font         = "regular 25pt Open Sans";

  if (parameters.description) {
    __wrap_text(
      _context, parameters.description, 86, _y + 70, _width - 200, 34
    );
  }

  let _output = parameters.directory + "/" + parameters.name + ".png";

  let _output_stream = fs.createWriteStream(_output);
  let _canvas_stream = _canvas.createPNGStream();

  _canvas_stream.pipe(_output_stream)

  return new Promise((resolve, reject) => {
    _output_stream.on("finish", () => {
      return resolve();
    });

    _output_stream.on("error", error => {
      return reject(error);
    });
  })
};

var replace_og_image = (buffer, options) => {
  let _html = buffer.toString();
  let _path = options.base(options.file, options) + "/" + options.name + ".png";

  _html = _html.replace(OG_IMAGE_REGEX, (match, url) => {
    return match.replace(url, _path);
  });

  _html = _html.replace(TWITTER_SRC_REGEX, (match, url) => {
    return match.replace(url, _path);
  });

  return Promise.resolve(Buffer.from(_html, "utf-8"));
};

var __wrap_text = (context, text, x, y, max_width, line_height) => {
  let _words        = text.split(" ");
  let _line         = "";

  for (let _word = 0; _word < _words.length; _word++) {
    let _current_line  = _line + _words[_word] + " ";
    let _metrics    = context.measureText(_current_line);
    let _test_width = _metrics.width;

    if (_test_width > max_width && _word > 0) {
      context.fillText(_line, x, y);
      _line = _words[_word] + " ";
      y    += line_height;
    } else {
      _line = _current_line;
    }
  }

  context.fillText(_line, x, y);

  return y;
}

module.exports = options => {
  return through.obj((file, enc, next) => {
    if (!options.directory) {
      next(new Error("directory option is required"));
    };

    if (!options.base) {
      next(new Error("base option is required"));
    };

    if (file.isNull()) {
      next(null, file);
      return;
    }

    const generate = (buffer, cb) => {
      try {
        add_og_image_to_html(file, buffer, options).then((contents) => {
          file.contents = contents;

          cb(null, file);
        });
      } catch (err) {
        next(err);
      }
    };

    return generate(file.contents, (err, res) => {
      next(err, res);
    });
  });
};