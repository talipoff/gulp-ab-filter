# gulp-ab-filter
[![npm version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Downloads][downloads-image]][downloads-url]
Use it for filtering and separating stream [vinyl] objects.
Easy to connect plugins in the chain for each branch.
Easy create custom handlers for objects.

## Installation
```sh
$ npm i -D gulp-ab-filter
```

## API

### The main module
```javascript
// Import
const gulp = require('gulp');
const abFilter = require('gulp-ab-filter');
```

```
abFilter(condition [, branches ] [, options])
         /            /               |
        /            +-> yes          +---{debug,               // enable debug mode to control the route of objects
       /             +-> yes, no           end(vinyl, cb, obj), // main end handler for all branches
      /              +-> namedBranch[]     flush(cb, obj),      // main flush handler for all branches
     /                   / | \             minimatch            // options which apply for blob condition
    |              {n: Name, p: Pipe }    }
    |
    |                     result
    +-> RegExp ---------> boolean
    +-> blob -----------> boolean
    +-> blob [] --------> boolean
    +-> function(vinyl)
    |      |
    |      +-> string --> branch name
    |      +-> other ---> boolean
    +-> other ----------> boolean
```

#### Condition
Possible types:
* [RegExp] - regular expression.
* [blob] string.
If [blob] starts with `!` this beginning is discarded, and the result is converted to the opposite.
* Array [blob] strings.
Only works the first match, the rest are ignored.
If the array is used only [blob] with `!` and and there are no matches then this is equivalent to true.
* Function - user-defined function with [vinyl] argument.
If function returns the string then used it as [branch](#branches) name else converted to a boolean.
* Other is converted to boolean.
Notice:
In the [RegExp] and [blob] is passed the function result [relPath](#relPath).

#### Branches
Parameter yes, no, namedBranch.p can be:
* gulp plugin
* function([vinyl], [cb](#cb), [obj](#obj))
* an array containing the gulp plugins and functions in any combination.

#### Cb
Callback function that must be called with two parameters:: null or error and [vinyl] object.
If the parameters are omitted, the object is not passed on.

#### Obj
A context object.
It contains two properties: n - [branch](#branches) name and the s - link to the [branch](#branches) stream.
[Branch](#branches) stream supports push.
Possible to set custom properties.

#### The logic of the filter:
1) [Condition](#condition) depending on its type is converted into `result`.
2) If the parameter [branches](#branches) is missing then push [obj](#obj) into empty [branch](#branches) *yes*.
3) If `result` === string then push [obj](#obj) into [branch](#branches) with the name = `result`.
If this [branch](#branches) not exists then push [obj](#obj) into [branch](#branches) *no*.
4) If `result` === true then push [obj](#obj) into [branch](#branches) *yes*.
5) If `result` === false then push [obj](#obj) into [branch](#branches) *no*.
6) If the property namedBranch.stop === true, then objects are not pushed.

#### Examples of usage: see [example.js]

#### 1. Stream filter [vinyl] objects.
```javascript
gulp.src('./test/**/*.txt')
	.pipe(abFilter('!**/block*')); // Exclude block files
```

#### 2. Stream filter [vinyl] objects and handlers.
```javascript
gulp.src('./test/**/*.txt')
	.pipe(abFilter('**/b*.txt', {
		end: (object, cb, obj) => {
			if (obj._result === undefined) {
				obj._result = new Vinyl({
					base: object.base,
					path: object.base + '/result.txt',
					contents: Buffer.from(object.contents)
				});
			} else {
				obj._result.contents = Buffer.concat([obj._result.contents, object.contents]);
			}
			cb(); // Don't push source files
		}, flush: (cb, obj) => {
			obj._result && obj.s.push(obj._result); // Push the result
			cb();
		}
	}));
```

#### 3. Use as a separator stream [vinyl] objects with a standard [branches](#branches) *yes* and *no*.
```javascript
const yes = [ // This set of plugins will be executed sequentially
	replaceP('r', '_'), // 1 gulp plugin
	(file, cb) => { // Function as 2 plugin
		// actions with the object, see examples in test.js
		file.contents = Buffer.from(String(file.contents).replace('_', '*'));
		cb(null, file); // Mandatory run the callback function
	},
	replaceP('*', '#') // 3 gulp plugin
]; // Re-use of yes is unacceptable!
const no = replaceP('b', 'B');

gulp.src('./test/**/*.txt')
	.pipe(abFilter('**/*t.txt', yes, no));
```

#### 4. Separator stream [vinyl] objects with a standard [branch](#branches) *yes* and the handler end.
```javascript
const end = (file, cb, obj) => {
	if (obj.n === 'Yes') {
		file.contents = Buffer.from(String(file.contents).replace('_', 'R'));
	} else {
		file.contents = Buffer.from(String(file.contents) + '=');
	}
	cb(null, file);
};

gulp.src('./test/**/*.txt')
	.pipe(abFilter('**/*t.txt', replaceP('r', '_'), {end: end}));
```

#### 5. Use as a separator stream [vinyl] objects with array of named [branches](#branches).
```javascript
const path = require('path');
const pipe1 = (file, cb) => {
	file.contents = Buffer.from(String(file.contents) + '1');
	cb(null, file);
};
const pipe2 = (file, cb) => {
	file.contents = Buffer.from(String(file.contents) + '2');
	cb(null, file);
};

gulp.src('./test/**/*.txt')
	.pipe(abFilter(
		file => {
			const relPathParts = abFilter.relPath(file).split(path.posix.sep);
			return relPathParts.length > 2 ? relPathParts[relPathParts.length-2] : '';
		}, // get last segment of path
		[{n: 'block1', p: pipe1}, {n: 'txt', p: pipe2}]));
```

#### 6. Two ways for flush stream.
See [example.js]

### abFilter.relPath([vinyl])
Returns the relative path to the [vinyl] including the object name
using the posix separators without the current directory.

### abFilter.match([vinyl], [condition](#condition) [, [minimathOptions]])
Returns a value which depends on the type [condition](#condition).

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

[example.js]:test/example.js
[vinyl]:https://github.com/gulpjs/vinyl
[Blob]:https://github.com/isaacs/node-glob
[minimatch]:https://github.com/isaacs/minimatch
[minimathOptions]:https://github.com/isaacs/minimatch#options
[RegExp]:https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/RegExp
[npm-image]: https://img.shields.io/npm/v/gulp-ab-filter.svg
[npm-url]: https://npmjs.org/package/gulp-ab-filter
[travis-image]: https://img.shields.io/travis/talipoff/gulp-ab-filter.svg
[travis-url]: https://travis-ci.org/talipoff/gulp-ab-filter
[downloads-image]: http://img.shields.io/npm/dm/gulp-ab-filter.svg
[downloads-url]: https://npmjs.org/package/gulp-ab-filter
