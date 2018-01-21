/* eslint-env mocha */
/* eslint-disable camelcase */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true, "allowTernary": true }] */
'use strict';
const Stream = require('stream');
const assert = require('chai').assert;
const gulp = require('gulp');
const map = require('map-stream');
const Vinyl = require('vinyl');
const abFilter = require('../');

const logger = (title, p) => console.log(`\x1b[31m ${title}: ${JSON.stringify(p)}`);

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

let result;
const finalizerPipes = (file, cb, obj) => {
	const name = obj.n;
	if (file) {
		if (!result[name]) {
			result[name] = [];
		}
		result[name].push({file: abFilter.relPath(file), contents: String(file.contents)});
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
			const fmatch = abFilter.match(file, parameter, options);
			if (fmatch !== false) {
				result.push({file: abFilter.relPath(file), match: fmatch});
			}
			cb(null, file);
		}
	))
	.pipe(map(
		(file, cb) => {
			if (filter) {
				(mode ? result.Out : result).push({file: abFilter.relPath(file), contents: String(file.contents)});
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

const yes = 'Yes';
const no = 'No';
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
const file1 = {file: n1, contents: c1};
const file2 = {file: n2, contents: c2};
const file3 = {file: n3, contents: c1 + '_' + c2};
const file3_1 = {file: n3, contents: c1 + '1_' + c2 + '1'};
const src = ['test/txt/**/*.txt'];
const src2 = ['test/txt/**/b*.txt'];

function m(obj, ...functions) {
	const result = {};
	Object.assign(result, obj);
	for (const f of functions) {
		result.contents = f(result.contents);
	}
	return result;
}
const f1 = s => s + '1';
const func1 = (file, cb) => {
	file.contents = Buffer.from(f1(String(file.contents)));
	cb(null, file);
};
const func1Yes = (file, cb, obj) => {
	if (obj.n === yes) {
		file.contents = Buffer.from(f1(String(file.contents)));
	}
	cb(null, file);
};
const func1No = (file, cb, obj) => {
	if (obj.n === no) {
		file.contents = Buffer.from(f1(String(file.contents)));
	}
	cb(null, file);
};
const f2 = s => s + '2';
const func2 = (file, cb) => {
	file.contents = Buffer.from(f2(String(file.contents)));
	cb(null, file);
};
const f3 = s => s + '3';
const func3 = (file, cb) => {
	file.contents = Buffer.from(f3(String(file.contents)));
	cb(null, file);
};
const f4 = s => s + '4';
const func4 = (file, cb) => {
	file.contents = Buffer.from(f4(String(file.contents)));
	cb(null, file);
};
const funcFlush = function (cb, obj) {
	obj._result && obj.s.push(obj._result);
	cb();
};
const funcFlushYes = function (cb, obj) {
	if (obj.n === yes) {
		obj._result && obj.s.push(obj._result);
	}
	cb();
};
// don't use direct
const funcEnd = function (file, cb, obj, streamName = yes, noPush) { // eslint-disable-line max-params
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
	funcEnd(file, cb, obj, yes);
};
const funcEndYesNoPush = function (file, cb, obj) {
	funcEnd(file, cb, obj, yes, true);
};
const funcEndNoPush = function (file, cb, obj) {
	funcEnd(file, cb, obj, yes, true);
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
		testMatch(file => abFilter.relPath(file) === 'test/txt/root.txt' ? 'v1' : false, etalon4, src, done);
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
		testMatch(abFilter('*/*/*t.txt', {debug: 1}), [root], src, done);
	});
	it('blob&!', done => {
		testMatch(abFilter('!*t.txt', {minimatch: {matchBase: true}}), [file1, file2], src, done);
	});
	it('blob2', done => {
		testMatch(abFilter('*[1|2].txt', {minimatch: {matchBase: true}}), [file1, file2], src, done);
	});
	it('blob with options minimatch', done => {
		testMatch(abFilter('*t.txt', {minimatch: {matchBase: true}}), [root], src, done);
	});
	it('function return yes', done => {
		testMatch(abFilter(file => abFilter.relPath(file) === 'test/txt/root.txt' ? 'Yes' : false), [root], src, done);
	});
	it('function return 1', done => {
		testMatch(abFilter(file => abFilter.relPath(file) === 'test/txt/root.txt' ? 1 : false), [root], src, done);
	});
	it('function return no', done => {
		testMatch(abFilter(() => 'No'), [], src, done);
	});
	it('function return false', done => {
		testMatch(abFilter(() => false, {debug: 1}), [], src, done);
	});
});

describe('filter with end handler:', () => {
	it('standart', done => {
		testMatch(abFilter('*[1|2].txt', {minimatch: {matchBase: true}, end: func1}),
		[m(file1, f1), m(file2, f1)], src, done);
	});
	it('select name', done => {
		testMatch(abFilter('*[1|2].txt', {minimatch: {matchBase: true}, end: func1Yes}),
		[m(file1, f1), m(file2, f1)], src, done);
	});
	it('push new file', done => {
		testMatch(abFilter('*[1|2].txt', {minimatch: {matchBase: true}, end:
			(file, cb, obj) => {
				obj.s.push(file);
				func1(file, cb);
			}
		}),
		[file1, m(file1, f1), file2, m(file2, f1)], src, done);
	});
});

describe('filter with end handler and flush stream:', () => {
	it('push sources', done => {
		testMatch(abFilter('*[1|2].txt', {minimatch: {matchBase: true}, end: funcEnd, flush: funcFlush}),
		[file1, file2, file3], src, done);
	});
	it('no push', done => {
		testMatch(abFilter('*[1|2].txt', {minimatch: {matchBase: true}, end: funcEndNoPush, flush: funcFlush}),
		[file3], src, done);
	});
	it('select name', done => {
		testMatch(abFilter('*[1|2].txt', {minimatch: {matchBase: true}, end: funcEndNoPush, flush: funcFlushYes}),
		[file3], src, done);
	});
});

describe('pipe Yes:', () => {
	it('function', done => {
		testMatch(abFilter(ss + '*2.txt', func1),
		[root, file1, m(file2, f1)], src, done);
	});
	it('plugin & function', done => {
		testMatch(abFilter(ss + '*2.txt', [replaceP('txt', 'txt2'), func1]),
		[root, file1, m(file2, f2, f1)], src, done);
	});
	it('function & plugin', done => {
		testMatch(abFilter(ss + '*2.txt', [func1, replaceP('txt1', 'txt')]),
		[root, file1, file2], src, done);
	});
	it('two functions', done => {
		testMatch(abFilter(ss + '*2.txt', [func1, func2]),
		[root, file1, m(file2, f1, f2)], src, done);
	});
	it('two functions with add new file', done => {
		testMatch(abFilter(ss + '*2.txt', [func1,
			(file, cb, obj) => {
				obj.s.push(file);
				cb(null, file);
			}]),
		[root, file1, m(file2, f1), m(file2, f1)], src, done);
	});
	it('two plugin', done => {
		testMatch(abFilter(ss + '*2.txt', [replaceP('txt', 'txt_'), replaceP('txt_', 'txt2')]),
		[root, file1, m(file2, f2)], src, done);
	});
	it('plugin with pipe', done => {
		const p1 = replaceP('txt', 'txt1');
		p1.pipe(replaceP('txt1', 'txt2', 50)).pipe(replaceP('txt2', 'txt3', 50));
		testMatch(abFilter(ss + '*2.txt', [p1, replaceP('txt3', 'txt4')]), [root, file1, m(file2, f4)], src, done);
	});
});

describe('pipes Yes & No:', () => {
	it('function', done => {
		testMatch(abFilter(ss + '*1.txt', func1, func2),
		[m(file1, f1), m(file2, f2)], src2, done);
	});
	it('two function', done => {
		testMatch(abFilter(ss + '*1.txt', [func1, func4], [func1, func2]),
		[m(file1, f1, f4), m(file2, f1, f2)], src2, done);
	});
});

describe('use end handler:', () => {
	it('Yes, no select', done => {
		testMatch(abFilter('*t.txt', func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			func1(file, cb, obj);
		}}),
		[m(root, f2, f1), m(file1, f1), m(file2, f1)], src, done);
	});
	it('Yes, select Yes', done => {
		testMatch(abFilter('*t.txt', func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			obj.n === yes ? func1(file, cb, obj) : cb(null, file);
		}}),
		[m(root, f2, f1), file1, file2], src, done);
	});
	it('Yes, select No', done => {
		testMatch(abFilter('*t.txt', func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			obj.n === no ? func1(file, cb, obj) : cb(null, file);
		}}),
		[m(root, f2), m(file1, f1), m(file2, f1)], src, done);
	});

	it('Yes & No, no select', done => {
		testMatch(abFilter('*t.txt', func1, func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			func1(file, cb, obj);
		}}),
		[m(root, f1, f1), m(file1, f2, f1), m(file2, f2, f1)], src, done);
	});
	it('Yes & No, select Yes', done => {
		testMatch(abFilter('*t.txt', func1, func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			obj.n === yes ? func1(file, cb, obj) : cb(null, file);
		}}),
		[m(root, f1, f1), m(file1, f2), m(file2, f2)], src, done);
	});
	it('Yes & No, select No', done => {
		testMatch(abFilter('*t.txt', func1, func2, {minimatch: {matchBase: true}, end: (file, cb, obj) => {
			obj.n === no ? func1(file, cb, obj) : cb(null, file);
		}}),
		[m(root, f1), m(file1, f2, f1), m(file2, f2, f1)], src, done);
	});

	it('Yes & No, Yes select', done => {
		testMatch(abFilter('*t.txt', func1, func2, {minimatch: {matchBase: true}, end: func1Yes}),
		[m(root, f1, f1), m(file1, f2), m(file2, f2)], src, done);
	});
	it('Yes & No, No select', done => {
		testMatch(abFilter('*t.txt', func1, func2, {minimatch: {matchBase: true}, end: func1No}),
		[m(root, f1), m(file1, f2, f1), m(file2, f2, f1)], src, done);
	});
});

describe('array of standart named pipes:', () => {
	it('Yes', done => {
		testMatch(abFilter(ss + '*2.txt', [{n: yes, p: func1}]),
		[root, file1, m(file2, f1)], src, done);
	});
	it('No', done => {
		testMatch(abFilter(ss + '*2.txt', [{n: no, p: func1}]),
		[m(root, f1), m(file1, f1), file2], src, done);
	});
	it('Yes & No', done => {
		testMatch(abFilter(ss + '*1.txt', [{n: yes, p: func1}, {n: no, p: func2}]),
		[m(file1, f1), m(file2, f2)], src2, done);
	});
	it('Yes&Stop', done => {
		testMatch(abFilter(ss + '*2.txt', [{n: yes, p: func1, stop: 1}], {end: finalizerPipes}),
		{Out: [root, file1], No: [root, file1], Yes: [m(file2, f1)]}, src, done);
	});
	it('No&Stop', done => {
		testMatch(abFilter(ss + '*2.txt', [{n: no, p: func1, stop: 1}], {end: finalizerPipes}),
		{Out: [file2], No: [m(root, f1), m(file1, f1)], Yes: [file2]}, src, done);
	});
	it('Yes&Stop & No&Stop', done => {
		testMatch(abFilter(ss + '*2.txt', [{n: yes, p: func1, stop: 1}, {n: no, p: func2, stop: 1}], {end: finalizerPipes}),
		{Out: [], No: [m(file1, f2)], Yes: [m(file2, f1)]}, src2, done);
	});
});

describe('array of custom named pipes:', () => {
	it('one pipe', done => {
		testMatch(abFilter(file => abFilter.relPath(file) === 'test/txt/root.txt' ? 'v1' : false,	[{n: 'v1', p: func1}]),
		[m(root, f1)], src, done);
	});
	it('one pipe with stop', done => {
		testMatch(abFilter(file => abFilter.relPath(file) === 'test/txt/root.txt' ? 'v1' : false,	[{n: 'v1', p: func1, stop: 1}], {end: finalizerPipes}),
		{Out: [], v1: [m(root, f1)]}, src, done);
	});
	it('2 pipes', done => {
		testMatch(abFilter(file => file.path.slice(-5), [{n: 't.txt', p: func1}, {n: '1.txt', p: func2}]),
		[m(root, f1), m(file1, f2)], src, done);
	});
	it('2 pipes with No', done => {
		testMatch(abFilter(file => file.path.slice(-5), [{n: 't.txt', p: func1}, {n: '1.txt', p: func2}, {n: no, p: func3}]),
		[m(root, f1), m(file1, f2), m(file2, f3)], src, done);
	});
	it('2 pipes with No, check out', done => {
		testMatch(abFilter(file => file.path.slice(-5), [{n: 't.txt', p: func1}, {n: '1.txt', p: func2}, {n: no, p: func3}], {end: finalizerPipes}),
		{Out: [m(root, f1), m(file1, f2), m(file2, f3)], 't.txt': [m(root, f1)], '1.txt': [m(file1, f2)], No: [m(file2, f3)]}, src, done);
	});
	it('1 pipes with No, check out', done => {
		testMatch(abFilter(file => file.path.slice(-5), [{n: 't.txt', p: func1}, {n: no, p: func3}], {end: finalizerPipes}),
		{Out: [m(root, f1), m(file1, f3), m(file2, f3)], 't.txt': [m(root, f1)], No: [m(file1, f3), m(file2, f3)]}, src, done);
	});
	it('2 pipes & unused Yes', done => {
		testMatch(abFilter(file => file.path.slice(-5), [{n: 't.txt', p: func1}, {n: '1.txt', p: func2}, {n: yes, p: func3}]),
		[m(root, f1), m(file1, f2)], src, done);
	});
	it('2 pipes & boolean Yes', done => {
		testMatch(abFilter(file => {
			if (file.path.slice(-5)[0] === 't') {
				return 'root';
			}
			if (file.path.slice(-5)[0] === '1') {
				return 1; // Convert to true
			}
			return true;
		}, [{n: 'root', p: func1}, {n: 1, p: func2}, {n: yes, p: func3}]),
		[m(root, f1), m(file1, f3), m(file2, f3)], src, done);
	});
});

describe('use end handler with named pipes:', () => {
	it('one pipe', done => {
		testMatch(abFilter(file => abFilter.relPath(file) === 'test/txt/root.txt' ? 'v1' : false,	[{n: 'v1', p: func1}], {end: func1}),
		[m(root, f1, f1)], src, done);
	});
	it('one pipe, select v1', done => {
		testMatch(abFilter(file => abFilter.relPath(file) === 'test/txt/root.txt' ? 'v1' : false,
			[{n: 'v1', p: func1}], {end: (file, cb, obj) => {
				obj.n === 'v1' ? func4(file, cb, obj) : cb(null, file);
			}}),
		[m(root, f1, f4)], src, done);
	});
	it('two pipes, select 1', done => {
		testMatch(abFilter(file => abFilter.relPath(file).slice(-5)[0],
			[{n: '1', p: func1}, {n: '2', p: func2}], {end: (file, cb, obj) => {
				obj.n === '1' ? func4(file, cb, obj) : cb(null, file);
			}}),
		[m(file1, f1, f4), m(file2, f2)], src, done);
	});
	it('one pipe, no match', done => {
		testMatch(abFilter(false,
			[{n: 'v1', p: func1}], {end: (file, cb, obj) => {
				obj.n === 'v1' ? func4(file, cb, obj) : cb(null, file);
			}}),
		[], src, done);
	});
});

describe('end handler with flush stream:', () => {
	it(yes, done => {
		testMatch(abFilter('*[1|2].txt', func1, {minimatch: {matchBase: true}, end: funcEndYes, flush: funcFlushYes}),
		[root, m(file1, f1), m(file2, f1), file3_1], src, done);
	});
	it('Yes, no push', done => {
		testMatch(abFilter('*[1|2].txt', func1, {minimatch: {matchBase: true}, end: funcEndYesNoPush, flush: funcFlushYes}),
		[root, file3_1], src, done);
	});
	it('Yes, no match', done => {
		testMatch(abFilter('*3.txt', func1, {minimatch: {matchBase: true}, end: funcEnd, flush: funcFlush}),
		[root, file1, file2], src, done);
	});
	it('only filter, no match', done => {
		testMatch(abFilter('*3.txt', {minimatch: {matchBase: true}, end: funcEnd, flush: funcFlush}),
		[], src, done);
	});
});

