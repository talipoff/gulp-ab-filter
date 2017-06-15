/* eslint-env mocha */
/* eslint-disable camelcase */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
'use strict';
const Stream = require('stream');
const assert = require('chai').assert;
const gulp = require('gulp');
const map = require('map-stream');
const Vinyl = require('vinyl');
const f = require('../');

// This is primitive plugin with delay for testing
const replaceP = function (search, replacement, delay) {
	delay = delay || 1;
	const tempStream = new Stream.Transform({objectMode: true});
	tempStream._transform = (file, enc, done) => {
		setTimeout(() => {
			file.contents = Buffer.from(String(file.contents).replace(search, replacement));
			done(null, file);
		}, delay);
	};
	return tempStream;
};

const logger = (title, p) => console.log(`\x1b[31m    ${title}: ${JSON.stringify(p)}`);
let result;
const finalizerPipes = (file, cb, obj) => {
	const name = obj.n;
	if (file && name !== 'Out') {
		if (!result[name]) {
			result[name] = [];
		}
		result[name].push({file: f.relPath(file), contents: String(file.contents)});
	}
	cb(null, file);
};
const testMatch = (parameter, etalon, src, done, options) => { // eslint-disable-line max-params
	const filter = parameter instanceof Stream ? parameter : null;
	const mode = filter && !Array.isArray(etalon); // Multi out, direct name is Out
	if (mode) {
		// Need test end of pipes
		result = {Out: []};
	} else {
		result = [];
	}
	const p = gulp.src(src)
	.pipe(filter ? parameter : map(
		(file, cb) => {
			const fmatch = f.match(file, parameter, options);
			if (fmatch !== false) {
				result.push({file: f.relPath(file), match: fmatch});
			}
			cb(null, file);
		}
	))
	.pipe(map(
		(file, cb) => {
			if (filter) {
				(mode ? result.Out : result).push({file: f.relPath(file), contents: String(file.contents)});
			}
			cb(null, file);
		}
	));
	const finalizer = () => {
		try {
			if (mode) {
				assert.deepEqual(etalon, result); // Compare objects
			} else {
				assert.sameDeepMembers(etalon, result); // Compare arrays
			}
			done();
		} catch (err) {
			logger('etalon', etalon);
			logger('result', result);
			done(err);
		}
	};
	p.on('finish', finalizer);
	p.on('end', finalizer);
};

const ss = '**/';
const nr = 'test/txt/root.txt';
const n1 = 'test/txt/block1/block1-file1.txt';
const n2 = 'test/txt/block1/block1-file2.txt';
const n3 = 'test/txt/block1/block1-file3.txt';
const cr = 'root.txt';
const c1 = 'block1-file1.txt';
const c2 = 'block1-file2.txt';

const etalon1 = [{file: nr, match: true}];
const etalon2 = [];
const etalon3 = [{file: nr, match: true}, {file: n1, match: true}, {file: n2, match: true}];
const etalon4 = [{file: nr, match: 'v1'}];
const etalon5 = [{file: n2, match: true}];

const root = {file: nr, contents: cr};
const root_1 = {file: nr, contents: cr + '_'};
const root_11 = {file: nr, contents: cr + '__'};
const root_111 = {file: nr, contents: cr + '___'};
const root_112 = {file: nr, contents: '_' + cr + '__'};
const root_12 = {file: nr, contents: '_' + cr + '_'};
const root_14 = {file: nr, contents: cr + '#'};

const file1 = {file: n1, contents: c1};
const file1_1 = {file: n1, contents: c1 + '_'};
const file1_2 = {file: n1, contents: '_' + c1};
const file1_3 = {file: n1, contents: '#' + c1};
const file1_12 = {file: n1, contents: '_' + c1 + '_'};
const file1_14 = {file: n1, contents: c1 + '#'};

const file2 = {file: n2, contents: c2};
const file2_1 = {file: n2, contents: c2 + '_'};
const file2_2 = {file: n2, contents: '_' + c2};
const file2_12 = {file: n2, contents: '_' + c2 + '_'};
const file2_3 = {file: n2, contents: '#' + c2};
const file2_5 = {file: n2, contents: 'block5-file2.txt'};

const file3 = {file: n3, contents: cr + '_' + c1 + '_' + c2};
const file3_1 = {file: n3, contents: c1 + '__' + c2 + '_'};

const src = ['test/txt/**/*.txt'];
const src2 = ['test/txt/**/b*.txt'];

const func0 = (file, cb) => {
	cb(null, file);
};
const func1 = (file, cb) => {
	file.contents = Buffer.from(String(file.contents) + '_');
	cb(null, file);
};
const func2 = (file, cb) => {
	file.contents = Buffer.from('_' + String(file.contents));
	cb(null, file);
};
const func3 = (file, cb) => {
	file.contents = Buffer.from('#' + String(file.contents));
	cb(null, file);
};
const func4 = (file, cb) => {
	file.contents = Buffer.from(String(file.contents).replace('_', '#'));
	cb(null, file);
};
const funcFlush = function (cb, obj, streamName = 'Out') {
	if (obj.n === streamName) {
		obj._result && obj.s.push(obj._result);
	}
	cb();
};
const funcFlushYes = function (cb, obj) {
	funcFlush(cb, obj, 'Yes');
};
const funcFlushExit = function (cb, obj) {
	funcFlush(cb, obj, 'Exit');
};
const funcEnd = function (file, cb, obj, streamName = 'Out', noPush) { // eslint-disable-line max-params
	if (obj.n === streamName) {
		if (obj._result === undefined) {
			obj._result = new Vinyl({
				base: file.base,
				path: file.base + '/block1/block1-file3.txt',
				contents: Buffer.from(file.contents)
			});
		} else {
			obj._result.contents = Buffer.concat([obj._result.contents, Buffer.from('_'), file.contents]);
		}
		if (noPush) {
			cb();
			return;
		}
	}
	cb(null, file);
};
const funcEndYes = function (file, cb, obj) {
	funcEnd(file, cb, obj, 'Yes');
};
const funcEndYesNoPush = function (file, cb, obj) {
	funcEnd(file, cb, obj, 'Yes', true);
};
const funcEndNoPush = function (file, cb, obj) {
	funcEnd(file, cb, obj, 'Out', true);
};
const funcEndNoPushExit = function (file, cb, obj) {
	funcEnd(file, cb, obj, 'Exit', true);
};

describe('match:', () => {
	it('blob', done => {
		testMatch('**/*t.txt', etalon1, src, done);
	});
	it('blob from root', done => {
		testMatch('test/txt/*t.txt', etalon1, src, done);
	});
	it('blob with options', done => {
		testMatch('*t.txt', etalon1, src, done, {matchBase: true});
	});
	it('blob invert', done => {
		testMatch('!**/b*.txt', etalon1, src, done);
	});
	it('blob two invert', done => {
		testMatch(['!**/b*1.txt', '!**/b*2.txt'], etalon1, src, done);
	});
	it('blob invert fist', done => {
		testMatch(['!**/b*.txt', '**/*.txt'], etalon1, src, done);
	});
	it('blob invert last', done => {
		testMatch(['*/*/*.txt', '!**/b*.txt'], etalon1, src, done);
	});
	it('blob exlude all', done => {
		testMatch(['!**/*.txt'], etalon2, src, done);
	});
	it('blob []', done => {
		testMatch([], etalon2, src, done);
	});
	it('regexp', done => {
		testMatch(/t\.txt$/, etalon1, src, done);
	});
	it('Boolean true', done => {
		testMatch(true, etalon3, src, done);
	});
	it('Boolean false', done => {
		testMatch(false, etalon2, src, done);
	});
	it('Other true', done => {
		testMatch(1, etalon3, src, done);
	});
	it('Other false', done => {
		testMatch(0, etalon2, src, done);
	});
	it('function true', done => {
		testMatch(() => true, etalon3, src, done);
	});
	it('function false', done => {
		testMatch(() => false, etalon2, src, done);
	});
	it('function string', done => {
		testMatch(file => f.relPath(file) === 'test/txt/root.txt' ? 'v1' : false, etalon4, src, done);
	});
	it('function use file property', done => {
		testMatch(file => !file.isDirectory(), etalon3, src, done);
	});
	it('function use file content', done => {
		testMatch(file => String(file.contents) === 'block1-file2.txt', etalon5, src, done);
	});
});

describe('filter:', () => {
	it('blob', done => {
		testMatch(f('*/*/*t.txt'), [root], src, done);
	});
	it('blob with options minimatch', done => {
		testMatch(f('*t.txt', {minimatch: {matchBase: true}}), [root], src, done);
	});
	it('function return Out', done => {
		testMatch(f(file => f.relPath(file) === 'test/txt/root.txt' ? 'Out' : false), [root], src, done);
	});
	it('function return custom out', done => {
		testMatch(f(file => f.relPath(file) === 'test/txt/root.txt' ? 'Exit' : false, {out: 'Exit'}), [root], src, done);
	});
	it('function return 1', done => {
		testMatch(f(file => f.relPath(file) === 'test/txt/root.txt' ? 1 : false), [root], src, done);
	});
	it('function return Yes', done => {
		testMatch(f(() => 'Yes'), [], src, done);
	});
	it('function return false', done => {
		testMatch(f(() => false, {debug: 1, out: 'ok'}), [], src, done);
	});
});

describe('filter with end handler:', () => {
	it('standart name', done => {
		testMatch(f('*[1|2].txt', {minimatch: {matchBase: true}, end: func1}),
		[file1_1, file2_1], src, done);
	});
	it('direct name', done => {
		testMatch(f('*[1|2].txt', {minimatch: {matchBase: true}, endOut: func1}),
		[file1_1, file2_1], src, done);
	});
	it('custom name', done => {
		testMatch(f('*[1|2].txt', {out: 'Exit', minimatch: {matchBase: true}, endExit: func1}),
		[file1_1, file2_1], src, done);
	});
	it('push new file', done => {
		testMatch(f('*[1|2].txt', {minimatch: {matchBase: true}, end:
			(file, cb, obj) => {
				obj.s.push(file);
				file.contents = Buffer.from(String(file.contents) + '_');
				cb(null, file);
			}
		}),
		[file1, file1_1, file2, file2_1], src, done);
	});
});

describe('filter with end handler and flush stream:', () => {
	it('push sources', done => {
		testMatch(f('*.txt', {minimatch: {matchBase: true}, end: funcEnd, flush: funcFlush}),
		[root, file1, file2, file3], src, done);
	});
	it('no push', done => {
		testMatch(f('*.txt', {minimatch: {matchBase: true}, end: funcEndNoPush, flush: funcFlush}),
		[file3], src, done);
	});
	it('direct name', done => {
		testMatch(f('*.txt', {minimatch: {matchBase: true}, end: funcEndNoPush, flushOut: funcFlush}),
		[file3], src, done);
	});
	it('custom name', done => {
		testMatch(f('*.txt', {out: 'Exit', minimatch: {matchBase: true}, end: funcEndNoPushExit, flushExit: funcFlushExit}),
		[file3], src, done);
	});
});

describe('pipe Yes:', () => {
	it('function', done => {
		testMatch(f(ss + '*2.txt', func1), [root, file1, file2_1], src, done);
	});
	it('plugin & function', done => {
		testMatch(f(ss + '*2.txt', [replaceP('block', '_block'), func1]), [root, file1, file2_12], src, done);
	});
	it('function & plugin', done => {
		testMatch(f(ss + '*2.txt', [func1, replaceP('block', '_block')]), [root, file1, file2_12], src, done);
	});
	it('two functions', done => {
		testMatch(f(ss + '*2.txt', [func1, func2]), [root, file1, file2_12], src, done);
	});
	it('two functions with add new file', done => {
		testMatch(f(ss + '*2.txt', [func1,
			(file, cb, obj) => {
				obj.s.push(file);
				cb(null, file);
			}]),
		[root, file1, file2_1, file2_1], src, done);
	});
	it('two plugin', done => {
		testMatch(f(ss + '*2.txt', [replaceP('txt', 'txt_'), replaceP('block', '_block')]),
		[root, file1, file2_12], src, done);
	});
	it('plugin with pipe', done => {
		const p1 = replaceP('block1', 'block2');
		p1.pipe(replaceP('block2', 'block3', 50)).pipe(replaceP('block3', 'block4', 50));
		testMatch(f(ss + '*2.txt', [p1, replaceP('block4', 'block5')]), [root, file1, file2_5], src, done);
	});
});

describe('pipes Yes & No:', () => {
	it('function', done => {
		testMatch(f(ss + '*1.txt', func1, func2), [file1_1, file2_2], src2, done);
	});
	it('two function', done => {
		testMatch(f(ss + '*1.txt', [func1, func4], [func1, func2]), [file1_14, file2_12], src2, done);
	});
});

describe('use end handler:', () => {
	it('Yes, select Out', done => {
		testMatch(f('*[1|2].txt', func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			obj.n === 'Out' ? func1(file, cb, obj) : cb(null, file);
		}}),
		[root_1, file1_12, file2_12], src, done);
	});
	it('Yes, select Yes', done => {
		testMatch(f('*.txt', func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			obj.n === 'Yes' ? func1(file, cb, obj) : cb(null, file);
		}}),
		[root_12, file1_12, file2_12], src, done);
	});
	it('Yes, no select', done => {
		testMatch(f('*t.txt', func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			func1(file, cb, obj);
		}}),
		[root_112, file1_1, file2_1], src, done);
	});
	it('Yes & No, select Out', done => {
		testMatch(f('*t.txt', func1, func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			obj.n === 'Out' ? func1(file, cb, obj) : cb(null, file);
		}}),
		[root_11, file1_12, file2_12], src, done);
	});
	it('Yes & No, select No', done => {
		testMatch(f('*t.txt', func1, func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			obj.n === 'No' ? func1(file, cb, obj) : cb(null, file);
		}}),
		[root_1, file1_12, file2_12], src, done);
	});
	it('Yes & No, No direct', done => {
		testMatch(f('*t.txt', func1, func2, {minimatch: {matchBase: true}, endNo: func1}),
		[root_1, file1_12, file2_12], src, done);
	});
	it('Yes, Yes direct & end', done => {
		testMatch(f('*t.txt', func1, {minimatch: {matchBase: true}, endYes: func1, end: func2}),
		[root_112, file1_2, file2_2], src, done);
	});
	it('Yes, Yes direct & Out direct ', done => {
		testMatch(f('*t.txt', func1, {minimatch: {matchBase: true}, endYes: func1, endOut: func2}),
		[root_112, file1_2, file2_2], src, done);
	});
	it('Yes, Yes direct & Out direct & end', done => {
		testMatch(f('*t.txt', func1, {minimatch: {matchBase: true}, endYes: func1, endOut: func2, end: func1}),
		[root_112, file1_2, file2_2], src, done);
	});
	it('Yes, Out direct & end', done => {
		testMatch(f('*t.txt', func1, {minimatch: {matchBase: true}, endOut: func2, end: func1}),
		[root_112, file1_2, file2_2], src, done);
	});
	it('Yes, Out and Yes direct & end', done => {
		testMatch(f('*t.txt', func1, {minimatch: {matchBase: true}, endYes: func0, endOut: func2, end: func1}),
		[root_12, file1_2, file2_2], src, done);
	});
});

describe('array of standart named pipes:', () => {
	it('Yes', done => {
		testMatch(f(ss + '*2.txt', [{n: 'Yes', p: func1}]), [root, file1, file2_1], src, done);
	});
	it('replace name Yes', done => {
		testMatch(f(ss + '*2.txt', [{n: 1, p: func1}], {yes: 1}), [root, file1, file2_1], src, done);
	});
	it('No', done => {
		testMatch(f(ss + '*2.txt', [{n: 'No', p: func1}]), [root_1, file1_1, file2], src, done);
	});
	it('Yes & No', done => {
		testMatch(f(ss + '*1.txt', [{n: 'Yes', p: func1}, {n: 'No', p: func2}]), [file1_1, file2_2], src2, done);
	});
	it('Yes-Stop', done => {
		testMatch(f(ss + '*2.txt', [{n: 'Yes', p: func1, stop: 1}], {end: finalizerPipes}),
			{Out: [root, file1], Yes: [file2_1]}, src, done);
	});
	it('No-Stop', done => {
		testMatch(f(ss + '*2.txt', [{n: 'No', p: func1, stop: 1}], {end: finalizerPipes}),
			{Out: [file2], No: [root_1, file1_1]}, src, done);
	});
	it('Yes-Stop & No-Stop', done => {
		testMatch(f(ss + '*2.txt', [{n: 'Yes', p: func1, stop: 1}, {n: 'No', p: func2, stop: 1}], {end: finalizerPipes}),
			{Out: [], Yes: [file2_1], No: [file1_2]}, src2, done);
	});
});

describe('array of custom named pipes:', () => {
	it('one pipe', done => {
		testMatch(f(file => f.relPath(file) === 'test/txt/root.txt' ? 'v1' : false,
			[{n: 'v1', p: func1}]), [root_1, file1, file2], src, done);
	});
	it('one pipe with stop', done => {
		testMatch(f(file => f.relPath(file) === 'test/txt/root.txt' ? 'v1Stop' : false,
			[{n: 'v1Stop', p: func1, stop: 1}], {end: finalizerPipes}),
			{Out: [file1, file2], v1Stop: [root_1]}, src, done);
	});
	it('2 pipes', done => {
		testMatch(f(file => file.path.slice(-5),
			[{n: 't.txt', p: func1}, {n: '1.txt', p: func2}]), [root_1, file1_2, file2], src, done);
	});
	it('2 pipes with No', done => {
		testMatch(f(file => file.path.slice(-5),
			[{n: 't.txt', p: func1}, {n: '1.txt', p: func2}, {n: 'No', p: func3}]), [root_1, file1_2, file2_3], src, done);
	});
	it('2 pipes and no', done => {
		testMatch(f(file => file.path.slice(-5),
			[{n: 't.txt', p: func1}, {n: '1.txt', p: func2}, {n: 'No', p: func3}], {end: finalizerPipes}),
			{Out: [root_1, file1_2, file2_3], 't.txt': [root_1], '1.txt': [file1_2], No: [file2_3]},
			src, done);
	});
	it('2 pipes & unused Yes', done => {
		testMatch(f(file => file.path.slice(-5),
			[{n: 't.txt', p: func1}, {n: '1.txt', p: func2}, {n: 'Yes', p: func3}]), [root_1, file1_2, file2], src, done);
	});
	it('2 pipes & boolean Yes', done => {
		testMatch(f(file => {
			if (file.path.slice(-5)[0] === 't') {
				return 'root';
			}
			if (file.path.slice(-5)[0] === '1') {
				return 1;
			}
			return true;
		},
			[{n: 'root', p: func1}, {n: 1, p: func2}, {n: 'Yes', p: func3}]), [root_1, file1_3, file2_3], src, done);
	});
});

describe('use end handler with named pipes:', () => {
	it('one pipe', done => {
		testMatch(f(file => f.relPath(file) === 'test/txt/root.txt' ? 'v1' : false,
			[{n: 'v1', p: func1}], {end: func1}),
			[root_111, file1_1, file2_1], src, done);
	});
	it('one pipe, select v1', done => {
		testMatch(f(file => f.relPath(file) === 'test/txt/root.txt' ? 'v1' : false,
			[{n: 'v1', p: func1}], {end: (file, cb, obj) => {
				obj.n === 'v1' ? func4(file, cb, obj) : cb(null, file);
			}}),
			[root_14, file1, file2], src, done);
	});
	it('two pipes, select 1', done => {
		testMatch(f(file => f.relPath(file).slice(-5)[0],
			[{n: '1', p: func1}, {n: '2', p: func2}], {end: (file, cb, obj) => {
				obj.n === '1' ? func4(file, cb, obj) : cb(null, file);
			}}),
			[root, file1_14, file2_2], src, done);
	});
	it('two pipes, select 1 direct', done => {
		testMatch(f(file => f.relPath(file).slice(-5)[0],
			[{n: '1', p: func1}, {n: '2', p: func2}], {end1: func4}),
			[root, file1_14, file2_2], src, done);
	});
	it('one pipe, no match', done => {
		testMatch(f(false,
			[{n: 'v1', p: func1}], {end: (file, cb, obj) => {
				obj.n === 'v1' ? func4(file, cb, obj) : cb(null, file);
			}}),
			[root, file1, file2], src, done);
	});
});

describe('end handler with flush stream:', () => {
	it('Yes', done => {
		testMatch(f('*[1|2].txt', func1, {minimatch: {matchBase: true}, end: funcEndYes, flush: funcFlushYes}
		), [root, file1_1, file2_1, file3_1], src, done);
	});
	it('Yes direct', done => {
		testMatch(f('*[1|2].txt', func1, {minimatch: {matchBase: true}, endYes: funcEndYes, flush: funcFlushYes}
		), [root, file1_1, file2_1, file3_1], src, done);
	});
	it('Yes, no push', done => {
		testMatch(f('*[1|2].txt', func1, {minimatch: {matchBase: true}, end: funcEndYesNoPush, flush: funcFlushYes}
		), [root, file3_1], src, done);
	});
	it('Yes, no match', done => {
		testMatch(f('*3.txt', func1, {minimatch: {matchBase: true}, end: funcEnd, flush: funcFlush}
		), [root, file1, file2, file3], src, done);
	});
	it('only filter, no match', done => {
		testMatch(f('*3.txt', {minimatch: {matchBase: true}, end: funcEnd, flush: funcFlush}
		), [], src, done);
	});
});

