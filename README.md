# gulp-ab-filter
[![npm version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Downloads][downloads-image]][downloads-url]
Use it for filtering and separating stream [vinyl] objects.
Easy to connect plugins in the chain for each branch.
Create your handlers to objects, including with the ability to accumulate and discharge into the branch.

## Installation
```sh
$ npm i -D gulp-ab-filter
```

## API

### The main module
```javascript
// Import
const gulp = require('gulp');
const ab = require('gulp-ab-filter');
```

ab([condition](#condition) [, branches ] [, options])
     |             |             |
     |             +-> [yes](#pipe)       +-{object}--+-> yes = Yes -|
   (types)         +-> [yes](#pipe), [no](#pipe)               +-> no =  No  -+-> set custom [name](#name) for branches
     |             +-> namedBranch []        +-> out = Out -|
     |                   / | \               +-> debug - enable debug mode to control the route of objects
     |   {n: [Name](#name), p: [pipe](#pipe), stop: Boolean}   +-> end([vinyl], [cb](#cb) [, [obj](#obj)]) - main end handler for all branches
     |                                       +-> flush([cb](#cb) [, [obj](#obj)]) - main flush handler for all branches
     +-> [RegExp] -------------------+       +-> end[Name](#name) - end handler for branch with the specified [именем](#name), replace main handler
     +-> [blob] ---------------------+       +-> flush[Name](#name) - flush handler for branch with the specified [именем](#name), replace main handler
     +-> [blob] [] ------------------+       +-> [minimathOptions] - minimatch options which apply for [blob] [condition](#condition)
     +-> function([vinyl])           |
     |      |                        |
     |      +-> String *result*      |
     |      +-> other - convert -> --+-> Boolean *result*
     |                               |
     +-> other - convert ------------+

#### <a name="condition"></a>Condition
In the [RegExp] and [blob] is passed the function result [relPath](#relPath).
Possible types:
* Function - user-defined functions with one argument of type [vinyl].
Returns the string to use named branches or automatically converted to a Boolean value.
* [RegExp] - regular expression.
* [blob] string.
If [blob] starts with `!`, the `!` is discarded and [blob] is running the inversion.
* Array [blob] strings.
Only works the first match, the rest are ignored. It is possible to use negation.
If the array uses only [blob] with `!` and not one does not work, then this is equivalent to the truth.
* Other is converted to Boolean expression.
For example: 1 - true, 0 - false

#### <a name="name"></a>Name
The name of the branch

#### <a name="pipe"></a>Pipe
Parameter yes, no, namedBranch.p can be:
* gulp plugin
* function ([vinyl], [cb](#cb) [, [obj](#obj)])
* an array containing the gulp plugins and functions in any combination.

#### <a name="cb">cb
Callback function that must be invoked with options: null or error and [vinyl] object.
If the parameters are omitted, the object is not passed on.

#### <a name="obj">obj
A context object.
It contains two properties: n - [branch name](#name) and the s - link to the branch stream.
Branch stream supports push.

#### The logic of the filter:
1) condition depending on its type is converted into *result*.
2) If the parameter is missing branches, only the branch output **out**.
It is possible to get objects for which the *result* = true or equal branch name **out**.
See [example](#_filter).
3) If there are branches, the objects for which the *result* = true will get standard branch **yes**.
The objects for which the *result* = false will fall into the standard branch **no**.
The objects for which the *result* of type String will be in the branch with the name *result* if there is
or if it is not then branch **no** if available.
If the object did not hit any one branch, he immediately falls in **out**.
The objects after passing all of the branches also fall in **out**.
If the property namedBranch.stop === true, then objects are not passed in **out**.
4) You can set the handler end. It will get the object when you exit from all branches. See [example](#_filterEnd).
5) You can set the end handler[Name](#name). It will include objects at the exit from the branch Name.
6) You can install a handler flush. It will be called during the cleanup of all branches. See [example](#_filterEndFlush).
7) You can set the end handler[Name](#name). It will be invoked when clearing branch Name.

#### Examples of usage:

#### <a name="_filter"></a>Use as a filter stream [vinyl] objects.
```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition[, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_filterEnd"></a>Filter using the handler end.
```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, {end: (object, cb, obj) => {
    func1(object); // the func1 handles the object: change the name, content, etc.
    cb(null, object);
  }})
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_filterEndFlush"></a>Filter using handlers end and flushing stream.
```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, {
    end: (object, cb, obj) => {
      if (obj._result === undefined) {
        obj._result = new Vinyl({
          base: object.base,
          path: object.base + '/new-file.txt',
          contents: Buffer.from(object.contents)
        });
      } else {
        obj._result.contents = Buffer.concat([obj._result.contents, object.contents]);
      }
      cb(); // here block object transfer
    }, flush: (cb, obj) => {
      obj._result && obj.s.push(obj._result); // push the result
      cb();
    }
  })
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_yes"></a>Use as a separator stream [vinyl] objects with a standard branch **yes**.
```javascript
const yes = [plugin1(parameters), plugin2(parameters),
  (object, cb) => {
    // actions with the object, see examples in test.js
    cb(null, object); // mandatory run the callback function
  }, plugin3(parameters) ];
    // re-use of yes is unacceptable!
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, yes [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_yesNo">Use as a separator stream [vinyl] objects with a standard branches **yes** and **no**.
```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, yes, no, [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_yesEnd"></a>Separator stream [vinyl] objects with a standard branch **yes** and the handler end.
```javascript
gulp.src('source/**/*.js')
  .pipe(ab(condition, yes , {end: (object, cb, obj) => {
    // here you will get objects from yes and out branches
    if(obj.n === 'Yes') { // check name of branch
	  // certain actions with object
    }
    cb(null, object); // or just cb() if you don't want to pass the object on
  }}))
  .pipe(pluginA())
  .pipe(gulp.dest('production/js'))
```
```javascript
// example with a named handler end
gulp.src('source/**/*.js')
  .pipe(ab(condition, yes , {endYes: (object, cb, obj) => {
    // here you will get objects from yes branch
    // certain actions with object
    cb(null, object); // or just cb() if you don't want to pass the object on
  }, end: (object, cb, obj) => {
    // here you will get objects only from Out stream
    // this handler can be omitted if there is no need
    // certain actions with object
    cb(null, object); // or just cb() if you don't want to pass the object on
  }}))
  .pipe(pluginA())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_named"></a>Use as a separator stream [vinyl] objects with array of named branches.
```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, [{n: 'Yes', p: pipe1}, {n: 'Name1', p: pipe2}, {n: 'Name2', p: pipe3}], [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

### <a name="relPath"></a>ab.relPath([vinyl])
Returns the relative path to the [vinyl] including the object name,
but without the current directory using the posix separators.

### ab.match([vinyl], [condition](#condition) [, [minimathOptions]])
Returns a value which depends on the type [condition](#condition).

#### Examples of usage:
```javascript
// condition as a function of
let result = ab.match(object,
  object => {
    if(object.isDirectory()) {
      return false;
    }
    if(object.dirname === 'test') {
      return false;
    }
    return true;
  });
// True for all js files ending in z
let result = ab.match(object, /z\.js$/);
// True for all js files in the current directory ending in a 1 or 2
let result = ab.match(object, '*[1|2].js');
// True for all js files in all folders starting from the current
let result = ab.match(object, '**/*.js');
// True for all js files in all folders starting from the current
let result = ab.match(object, '*.js', {matchBase: true});
// Use of negation:
// True for all files except js
let result = ab.match(object, '!*.js', {matchBase: true});
// True for all js files except starting with b
let result = ab.match(object, ['!**/b*.js', '**/*.js']);
// True for all js files in addition to beginning with a b, but not with ba
let result = ab.match(object, ['**/ba*.js', '!**/b*.js', '**/*.js']);
```

## Contribute
Please send your improvements and enhancements. To begin, you must perform preparatory steps:
```sh
git clone https://github.com/talipoff/gulp-ab-filter
cd gulp-ab-filter
npm i
```

After you need to run the tests:
```sh
npm run -s test-src
npm run -s test-logic
```

[vinyl]:github.com/gulpjs/vinyl
[Blob]:github.com/isaacs/node-glob
[minimatch]:github.com/isaacs/minimatch
[minimathOptions]:github.com/isaacs/minimatch#options
[RegExp]:developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/RegExp
[npm-image]: https://img.shields.io/npm/v/gulp-ab-filter.svg
[npm-url]: https://npmjs.org/package/gulp-ab-filter
[travis-image]: https://img.shields.io/travis/talipoff/gulp-ab-filter.svg
[travis-url]: https://travis-ci.org/talipoff/gulp-ab-filter
[downloads-image]: http://img.shields.io/npm/dm/gulp-ab-filter.svg
[downloads-url]: https://npmjs.org/package/gulp-ab-filter
