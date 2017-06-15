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

module.exports = (condition, p1, p2, userConfig) => {
	const np = Array.isArray(p1) && typeof p1[0] !== 'function' && !(p1[0] instanceof Stream); // Named pipes
	const pipesV = np ? p1 : [];
	let config = Object.assign({yes: 'Yes', no: 'No', out: 'Out'}, np ? p2 : userConfig);
	function checkPar(p, n) {
		if (typeof p === 'function' || p instanceof Stream || Array.isArray(p)) {
			pipesV.push({n, p});
			return true;
		}
		config = Object.assign(config, p);
	}
	if (!np) {
		checkPar(p1, config.yes) && checkPar(p2, config.no);
	}
	['yes', 'no', 'out'].forEach(item => {
		config[item] = String(config[item]);
	});

	const pipesEnd = new Map();
	const pipes = {};

	function logFile(name, file) {
		config.debug && console.log(`> ${name} > "${typeof file === 'string' ? file : relPath(file)}"`);
	}

	function addTransform(stream, name) {
		let nameH = 'end' + name;
		if (!config[nameH]) {
			nameH = 'end';
		}
		const end = config[nameH];
		if (end) {
			stream._transform = (file, enc, cb) => {
				logFile(name + '_' + nameH, file);
				const uo = pipesEnd.get(name);
				uo.flush || end(file, cb, uo);
			};
			stream.resume();
		}
	}

	function addFlush(stream, name) {
		let nameH = 'flush' + name;
		if (!config[nameH]) {
			nameH = 'flush';
		}
		const flush = config[nameH];
		if (flush) {
			stream._flush = cb => {
				logFile(name + '_' + nameH, '');
				const uo = pipesEnd.get(name);
				uo.flush = true;
				flush(cb, uo);
			};
		}
	}

	const proxy = new Stream.PassThrough({objectMode: true});
	pipesEnd.set(config.out, {s: proxy, n: config.out});
	addFlush(proxy, config.out);
	addTransform(proxy, config.out);
	pipes[config.out] = proxy;

	const selector = new Stream.Transform({objectMode: true});
	selector._transform = (file, enc, done) => {
		const cond = match(file, condition, config.minimatch);
		let fw = 0;

		function write(name) {
			if (!pipes[name]) {
				return;
			}
			fw++;
			logFile(name, file);
			pipes[name].write(file);
		}

		if (pipesV.length === 0) { // Only filter
			if (cond === true || cond === config.out) {
				write(config.out);
			}
		} else {
			const condS = (typeof cond === 'boolean') ? (cond ? config.yes : config.no) : cond;
			write(condS);
			if (!fw && typeof cond === 'string' && cond !== config.no) {
				write(config.no);
			}
			if (!fw) {
				write(config.out);
			}
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
		addFlush(se, name);
		addTransform(se, name);
		se.on('end', () => {
			pipesEnd.delete(name);
			if (pipesEnd.size < 2) {
				proxy.end();
			}
		});
		s = s.pipe(se);

		if (!p.stop) {
			s.pipe(proxy, {end: false});
		}
	}

	selector.on('end', () => {
		let c = 0;
		// eslint-disable-next-line guard-for-in
		for (const name in pipes) {
			(name !== config.out) && pipes[name].end();
			c++;
		}
		(c === 1) && proxy.end();
	});
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
