/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true }] */
/* eslint-disable no-use-before-define */
// https://js-node.ru/site/article?id=41#stream_events_finish_and_end
'use strict';
const path = require('path');
const Stream = require('stream');
const gulp = require('gulp');
const Vinyl = require('vinyl');
const abFilter = require('../');

const color1way = '\x1b[31m';
const color2way = '\x1b[32m';
const nl = '\n';

// This is primitive plugin with delay for testing
const replaceP = function (search, replacement, delay) {
	delay = delay || 10;
	const tempStream = new Stream.Transform({objectMode: true});
	tempStream._transform = (file, enc, done) => {
		setTimeout(() => {
			file.contents = Buffer.from(String(file.contents).replace(search, replacement));
			done(null, file);
		}, delay);
	};
	return tempStream;
};

const examples = [];
examples.push(() => {
	console.log('1. Stream filter vinyl objects:');
	gulp.src('./test/**/*.txt')
		.pipe(abFilter('!**/block*')) // Exclude block files
		.pipe(abFilter(file => console.log(abFilter.relPath(file)) || 1, {flush: examples.shift()})) // Use abFilter for logging
	;
});

examples.push(() => {
	console.log(nl + '2. Stream filter vinyl objects and handlers:');
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
		}))
		.pipe(abFilter(file => console.log(abFilter.relPath(file)) || 1, {flush: examples.shift()})) // Use abFilter for logging
	;
});

examples.push(() => {
	console.log(nl + '3. Use as a separator stream vinyl objects with a standard branch yes and no:');

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
		.pipe(abFilter('**/*t.txt', yes, no))
		.pipe(abFilter(file => console.log(abFilter.relPath(file) + ':' + String(file.contents)) || 1, {flush: examples.shift()})) // Use abFilter for logging
	;
});

examples.push(() => {
	console.log(nl + '4. Separator stream vinyl objects with a standard branch yes and the handler end:');

	const end = (file, cb, obj) => {
		if (obj.n === 'Yes') {
			file.contents = Buffer.from(String(file.contents).replace('_', 'R'));
		} else {
			file.contents = Buffer.from(String(file.contents) + '=');
		}
		cb(null, file);
	};

	gulp.src('./test/**/*.txt')
		.pipe(abFilter('**/*t.txt', replaceP('r', '_'), {end}))
		.pipe(abFilter(file => console.log(abFilter.relPath(file) + ':' + String(file.contents)) || 1, {flush: examples.shift()})) // Use abFilter for logging
	;
});

examples.push(() => {
	console.log(nl + '5. Use as a separator stream vinyl objects with array of named branches:');

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
				return relPathParts.length > 2 ? relPathParts[relPathParts.length - 2] : '';
			}, // Get last segment of path
			[{n: 'block1', p: pipe1}, {n: 'txt', p: pipe2}]))
		.pipe(abFilter(file => console.log(abFilter.relPath(file) + ':' + String(file.contents)) || 1, {flush: examples.shift()})) // Use abFilter for logging
	;
});

examples.push(() => {
	console.log(nl + '6. Two ways for flush stream:');

	gulp.src('./test/**/*.txt')
		.pipe(abFilter('**/b*.txt',
			(file, cb, obj) => {
				if (obj._all === undefined) {
					obj._all = '';
					obj.s.on('end', () => {
						// First way
						console.log(color1way + 'custom flush:' + obj._all);
					});
				} else {
					obj._all += '|1|';
				}
				obj._all += String(file.contents);
				cb(null, file);
			},
			{
				debug: 1,
				end: (file, cb, obj) => {
					// If(obj.n = 'Yes') {
					if (obj._all === undefined) {
						obj._all = '';
					} else {
						obj._all += '|2|';
					}
					// }
					obj._all += String(file.contents);
					cb(null, file);
				}, flush: (cb, obj) => {
					// Second way
					if (obj.n === 'Yes') {
						console.log(color2way + 'option flush:' + obj._all);
					}
					cb();
				}
			}
		))
		.pipe(abFilter(file => console.log('out:', abFilter.relPath(file)) || 1)) // Use abFilter for logging
	;
});

examples.shift()();
