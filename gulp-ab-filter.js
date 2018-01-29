/* eslint-env node */
/* eslint no-unused-expressions: ["error", { "allowShortCircuit": true }] */
'use strict';
const path = require('path');
const Stream = require('stream');
const minimatch = require('minimatch');

function relPath(file) {
	return path.relative(file.cwd, file.path).split(path.sep).join(path.posix.sep);
}

function match(file, condition, options) {
	let res;
	if (typeof condition === 'function') {
		res = condition(file);
		return res === undefined ? false : typeof res === 'string' ? res : Boolean(res);
	}
	if (condition instanceof RegExp) {
		return condition.test(relPath(file));
	}
	if (typeof condition === 'string') {
		condition = [condition];
	}
	if (Array.isArray(condition)) {
		if (condition.length === 0) {
			return false;
		}
		res = condition[0][0] === '!';
		for (let pattern of condition) {
			let flagInversion = false;
			if (pattern[0] === '!') {
				pattern = pattern.slice(1);
				flagInversion = true;
			} else {
				res = false;
			}
			if (minimatch(relPath(file), pattern, options)) {
				return !flagInversion;
			}
		}
		return res;
	}
	return Boolean(condition);
}

module.exports = (condition, p1, p2, userConfig) => { // eslint-disable-line complexity
	const yes = 'Yes';
	const no = 'No';
	const nameFlush = 'flush';
	const nameEnd = 'end';

	let config;
	let pipesV;

	function checkPar(n, p, stop = false) {
		if (typeof p === 'function' || p instanceof Stream || Array.isArray(p)) {
			// This is branch
			for (const el of pipesV) {
				if (el.n === n) {
					return true;
				}
			}
			pipesV.push({n, p, stop});
			return true;
		}
		config = p;
	}

	if (Array.isArray(p1) && typeof p1[0] !== 'function' && !(p1[0] instanceof Stream)) {
		// NamedBranch[]
		pipesV = p1;
		config = p2;
		checkPar(yes, []);
		checkPar(no, []);
	} else {
		pipesV = [];
		checkPar(yes, p1) && checkPar(no, p2) && (config = userConfig);
		if (pipesV.length === 0) {
			checkPar(yes, []);
		} else if (pipesV.length === 1) {
			checkPar(no, []);
		}
	}
	config = config || {};

	function logFile(name, file) {
		if (!config.debug) {
			return;
		}
		let s = typeof file === 'string' ? file : relPath(file);
		if (s.length > 0) {
			s = ' > "' + s + '"';
		}
		console.log(`> ${name}${s}`);
	}

	const pipesEnd = new Map();
	const pipes = {};
	const proxy = new Stream.PassThrough({objectMode: true});

	const selector = new Stream.Transform({objectMode: true});
	selector._transform = (file, enc, done) => {
		const cond = match(file, condition, config.minimatch);
		let fw = 0;

		function write(name) {
			if (!pipes[name]) {
				if (pipesV.length > 1) {
					logFile(name, 'branch not found');
				}
				return;
			}
			fw++;
			logFile(name, file);
			pipes[name].write(file);
		}

		const condS = (typeof cond === 'boolean') ? (cond ? yes : no) : cond;
		write(condS);
		if (!fw) {
			write(no);
		}
		done();
	};

	for (const p of pipesV) {
		const plugins = Array.isArray(p.p) ? p.p : [p.p];
		const name = String(p.n);
		let s;
		for (const el of plugins) {
			let plugin;
			if (typeof el === 'function') {
				const tempStream = new Stream.Transform({objectMode: true});
				tempStream._gulpAbFilter = {s: tempStream, n: name};
				tempStream._transform = (file, enc, done) => {
					el(file, done, tempStream._gulpAbFilter);
				};
				plugin = tempStream;
			} else {
				plugin = el;
				if (!plugin.readable) {
					throw new Error(`stream "${name}" isn't readable!`);
				}
			}
			if (s) {
				s = s.pipe(plugin);
			} else {
				pipes[name] = plugin;
				s = plugin;
				while (s._readableState && s._readableState.pipesCount) {
					if (s._readableState.pipesCount > 1) { // eslint-disable-line max-depth
						throw new Error(`stream "${name}" has many pipes!`);
					}
					s = s._readableState.pipes;
				}
			}
		}

		const se = new Stream.PassThrough({objectMode: true});
		pipesEnd.set(name, {s: se, n: name});

		const end = config[nameEnd];
		if (end) {
			se._transform = (file, enc, cb) => {
				logFile(name + '_' + nameEnd, file);
				const uo = pipesEnd.get(name);
				uo.flush || end(file, cb, uo);
			};
			se.resume();
		}

		const flush = config[nameFlush];
		if (flush) {
			se._flush = cb => {
				logFile(name + '_' + nameFlush, '');
				const uo = pipesEnd.get(name);
				uo.flush = true;
				flush(cb, uo);
			};
		}

		const seEnd = () => {
			pipesEnd.delete(name);
			if (pipesEnd.size < 1) {
				proxy.end();
			}
		};
		se.on('end', seEnd);
		if (s) {
			s = s.pipe(se);
		} else {
			s = se;
			pipes[name] = s;
		}

		if (!p.stop) {
			s.pipe(proxy, {end: false});
		}
	}

	const selectorEnd = () => {
		let c = 0;
		// eslint-disable-next-line guard-for-in
		for (const name in pipes) {
			pipes[name].end();
			c++;
		}
		(c === 0) && proxy.end();
	};

	selector.on('end', selectorEnd);

	selector.resume(); // Switch the stream into flowing mode

	proxy.once('pipe', src => {
		if (typeof src.unpipe === 'function') {
			src.unpipe(proxy);
		} else {
			for (const listener of proxy.listeners('close')) {
				if (listener.name === 'cleanup' || listener.name === 'onclose') {
					listener.call(proxy);
				}
			}
		}
		src.pipe(selector);
	});
	return proxy;
};

module.exports.match = match;
module.exports.relPath = relPath;
