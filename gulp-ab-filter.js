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
	const readyProperty = 'abReady';
	const nameStreamObj = '_gulpAbFilter';
	const namePushAdapter = 'push_';

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
	if (!('name' in config)) {
		config.name = '';
	}

	function logFile(name, file) {
		if (!config.debug) {
			return;
		}
		let s;
		if (file === undefined) {
			s = '';
		} else if (file !== null && typeof file === 'object') {
			s = relPath(file);
		} else {
			s = String(file);
		}
		if (s.length > 0) {
			s = ' > "' + s + '"';
		}
		const pn = config.name === '' ? '' : '(' + config.name + ')';
		console.log(`${pn} > ${name}${s}`);
	}

	const pipes = {}; // Start branch
	const pipesEnd = new Map(); // End branch
	const end = config[nameEnd];
	const flush = config[nameFlush];
	let flagNull = 0;
	let pipesSize = 1;

	const selector = new Stream.PassThrough({objectMode: true});

	selector._transform = (file, enc, cb) => {
		if (readyProperty in file) {
			delete file[readyProperty];
			cb(null, file);
			return;
		}

		const cond = match(file, condition, config.minimatch);

		function write_(name) {
			if (!(name in pipes)) {
				if (pipesV.length > 1) {
					logFile(name, 'branch not found');
				}
				return;
			}
			logFile(name, file);

			if (pipes[name] === null) {
				if (end && !flush) {
					logFile(name + '_out', file);
					end(file, cb, {s: selector, n: name});
				} else {
					cb(null, file);
				}
			} else {
				pipes[name].write(file);
				cb();
			}
			return 1;
		}

		const condS = (typeof cond === 'boolean') ? (cond ? yes : no) : cond;

		if (!write_(condS)) {
			if (!write_(no)) {
				cb();
			}
		}
	};

	for (const p of pipesV) {
		const plugins = Array.isArray(p.p) ? p.p : [p.p];
		const name = String(p.n);
		let s;
		for (const el of plugins) {
			let plugin;
			if (typeof el === 'function') {
				const tempStream = new Stream.PassThrough({objectMode: true});
				tempStream[nameStreamObj] = {s: tempStream, n: name};
				tempStream._transform = (file, enc, done) => {
					el(file, done, tempStream[nameStreamObj]);
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

		if (!s && !flush) {
			pipes[name] = null;
			continue;
		}
		pipesSize++;

		const se = new Stream.PassThrough({objectMode: true});
		pipesEnd.set(name, {s: se, n: name});

		if (end) {
			se._transform = (file, enc, cb) => {
				logFile(name + '_out', file);
				const uo = pipesEnd.get(name);
				uo.flush || end(file, cb, uo);
			};
			se.resume();
		}

		se[namePushAdapter] = se.push;
		se.push = file => {
			if (file) {
				file[readyProperty] = name;
			}
			if (!p.stop || file === null) {
				selector.push(file);
			}
		};

		if (flush) {
			se._flush = cb => {
				logFile(name + '_flush');
				const uo = pipesEnd.get(name);
				uo.flush = true;
				flush(cb, uo); // For each branches
			};
		}

		const seEnd = () => {
			selector.end();
		};
		se.on('end', seEnd);

		if (s) {
			s = s.pipe(se);
		} else {
			s = se;
			pipes[name] = s;
		}
	}

	if (pipesSize > 0) {
		// To intercept the end
		selector[namePushAdapter] = selector.push;
		selector.push = file => {
			if (file === null) {
				if (flagNull === 0) {
					// eslint-disable-next-line guard-for-in
					for (const name in pipes) {
						if (pipes[name] !== null) {
							pipes[name].end(); // Close all branches
						}
					}
				}
				flagNull++;
				if (flagNull < pipesSize) {
					return; // Don't push null, to wait for the closing of all branches
				}
			} else {
				delete file[readyProperty];
			}
			selector[namePushAdapter](file);
		};
	}

	selector.resume(); // Switch the stream into flowing mode
	return selector;
};

module.exports.match = match;
module.exports.relPath = relPath;
