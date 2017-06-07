# gulp-ab-filter
Use it for filtering and separating stream [vinyl] objects.
There is only one external dependency [minimatch].
Easy to connect plugins in the chain for each branch.
Create your handlers to objects, including with the ability to accumulate and discharge into the stream.

## Installation

```sh
$ npm install -D gulp-ab-filter
```

## API

### The main module
---

```javascript
// Import
const gulp = require('gulp');
const ab = require('gulp-ab-filter');
```

#### Use as a `filter` stream [vinyl] objects.
Next, you'll get only the objects for which the condition is true.
Here works a standard stream `out`.

```
(input) --> <condition === true || Out> --> (Out)
```
*Attention: if the condition is a function that returns the name of the stream, then the object gets there*

*Note: the diagrams depict streams with standard names.*

```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition[, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

##### condition [see match](#match)
##### options
```javascript
{
  // options with default values
  yes: 'Yes',           // the name of the default stream yes
  no: 'No',             // the name of the standard stream no
  out: 'Out'            // the name of the standard stream output
  debug: false,         // enable debug mode to control the route of objects
  end: undefined,       // handler end all threads
  endName: undefined,   // handler for the end of the stream with the specified name, replace the end handler
  flush: undefined,     // handler for flush all streams
  flushName: undefined, // handler for flush the stream with the specified name, replace the flush handler
  minimatch: undefined  // minimatch options which apply for the condition
}
```

#### <a name="end"></a>`Filter` using the handler end.
Uses standard out stream, because the objects are there.
The first handler parameter is an object [vinyl].
The second parameter is the callback function that should be called with a null or an error and the object.
If the parameters are omitted, the object is not passed on.
The third parameter for the handler of `obj` is the object context.
It contains two properties: n - the name of the stream and s - the link to the thread.
Stream supports push new objects.

```
(input) --> <condition === true || Out> --> (Out --> [endOut || end])
```
*Attention: if the condition is a function that returns the name of the stream, then the object gets there.
If there is a named handler `end` then main handler is not invoke in this stream.*

```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, {end: (object, cb) => {
    func1(object); // the func1 handles the object: change the name, content, etc.
    cb(null, object);
  }})
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### `Filter` using handlers end and flushing stream.
The handler parameters, such as parameters [handler the end](#end), only without the first.
Example shows how to connect the stream to a new object. Thus go through only the new object.

```
(input) -> <condition === true || Out> --> (Out -> [endOut || end][flushOut || flush])
```
*Attention: if condition is a function that returns the name of the output stream, it will be equivalent to true.
If there is a named handler end then main handler is not invoke in this stream*

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

#### Use as a `separator` stream [vinyl] objects with a standard stream of `yes`.
The objects for which the condition is true, fall into the stream `yes` and further to the output stream `out`,
the rest directly to the output stream `out`.

```
(input) -> <condition === true || Yes> --> (Yes) --> (Out)
           <Else> -------------------------------------^
```
*Attention: if condition is a function that returns the name of the output stream, it will be equivalent to true.*

```javascript
const yes = [plugin1(parameters), plugin2(parameters),
  (object, cb) => {
    // actions with the object, see examples in test.js
    cb(null, object); // mandatory run the callback function
  }, plugin3(parameters) ];
    // re-use of `yes` is unacceptable!
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, yes [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```
#####  <a name="Yes"></a>Yes - this is the pipe that can be:
* standard gulp plugin
* function of mini plugin, see handler [end](#end)
* an array of first and second in any combination. The execution is done in the order listed.
This allows us to construct the deferred plugin chain.

*Attention! The pipe can only be used once.*

#### Use as a `separator` stream [vinyl] objects with a standard stream of `yes` and `no`.
The objects for which the condition is true, fall into the stream `yes` and further to the output stream `out`,
others come to the thread to `no` and further to the output stream `out`.

```
(input) -> <condition === true || Yes> --> (Yes) --> (Out)
           <Else> --> (No) ----------------------------^
```
*Attention: if condition is a function that returns the name of the output stream, it will be equivalent to true.*

```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, yes, no, [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

##### No - the same as [`Yes`](#Yes)

##### `Separator` stream [vinyl] objects with a standard stream of `yes` and the handler `end`.

```
(input) -> <condition === true || Yes> --> (Yes [endYes || end]) --> (Out --> [endOut || end])
           <Else> -----------------------------------------------------^
```
*Attention: if condition is a function that returns the name of the output stream, it will be equivalent to true.
If there is a named handler `end` then main handler is not invoke in this stream*

```javascript
gulp.src('source/**/*.js')
  .pipe(ab(condition, yes , {end: (object, cb, obj) => {
    // here you will get objects from Yes and Out streams
    if(obj.n === 'Yes') { // check name of stream
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
    // here you will get objects from Yes stream
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

#### Use as a `separator` stream [vinyl] objects with array of named streams.
The objects for which the condition is true, fall into the stream `yes` and further to the output stream `Out`,
else if condition equal name of stream then fall into this stream and further to the output stream `Out`,
others come to the thread to `no` and further to the output stream `out`.

```
(input) -> <condition === true || Yes> --> (Yes) --> (Out)
           <condition === Out> ------------------------^
           <condition === Name1> --> (Name1) ----------^
           <condition === Name2> --> (Name2) ----------^
           <condition === No> --> (No) ----------------^
           <Else> --> (No) --------^
```

```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, [{n: 'Yes', p: pipe1}, {n: 'Name1', p: pipe2}, {n: 'Name2', p: pipe3}], [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```
##### n: name1 - the name of stream
##### p: pipe1 - the pipe same as [`Yes`](#Yes)
##### stop: value - if value equivalent to true then objects don't send to `out`

### relPath(object)
---
Returns the relative path to the [vinyl] including the object name,
but without the current directory using the posix separators.

```javascript
// Import
const ab = require('gulp-ab-filter');
// somewhere below
let path = ab.relPath(object);
```

### <a name="match"></a>match(object, condition[, options])
---
Returns a Boolean value or a string, if condition is a function that returns a Boolean value that is automatically converted to a string. String is used when we need to handle named streams.

```javascript
// Import
const match = require('gulp-ab-filter').match;
// somewhere below
let result = match(object, condition[, options]);
```

#### object
* It is [vinyl] object which represents a file, folder, etc.
#### condition
Possible types:
* Function - user-defined functions with one argument of type [vinyl].
Returns a string for use with named streams or result converted to Boolean value.

```javascript
let result = match(object,
  object => {
    if(object.isDirectory()) {
      return false;
    }
    if(object.dirname === 'test') {
      return false;
    }
    return true;
  });
```

* [RegExp] - regular expression. Returns `condition.test(path)`.

```javascript
// True for all js objects ending in z
let result = match(object, /z\.js$/);
```

* [blob] string.

```javascript
// True for all js objects in the current directory ending in a 1 or 2
let result = match(object, '*[1|2].js');
// True for all js objects in all folders starting from the current
let result = match(object, '**/*.js');
// True for all js objects in all folders starting from the current
let result = match(object, '*.js', {matchBase: true});
```

Use of negation:

```javascript
// True for all objects except js
let result = match(object, '!*.js', {matchBase: true});
```

* Array [blob] strings.
Only works the first match, the rest are ignored. It is possible to use negation.

```javascript
// True for all js objects except starting with b
let result = match(object, ['!**/b*.js', '**/*.js']);
// True for all js objects in addition to beginning with a b, but not with ba
let result = match(object, ['**/ba*.js', '!**/b*.js', '**/*.js']);
```

* Other standard types are converted to a logical expression.
For example: 1 - true, 0 - false
#### options (Опции)
* [Minimatch options] for filter settings.

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
[Minimatch опции]:github.com/isaacs/minimatch#options
[RegExp]:developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/RegExp