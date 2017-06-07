'use strict';
const gulp = require('gulp');
const f = require('../');

// Two ways for flush stream
gulp.src('./test/**/*.txt')
.pipe(f('**/b*.txt',
	[
		(file, cb, obj) => {
			if (obj._all === undefined) {
				obj._all = '';
				obj.s.on('end', () => {
					console.log('\x1b[31m custon flush:' + obj._all);
				});
			}
			obj._all += String(file.contents) + '_';
			cb(null, file);
		}
	],
	{debug: 1, endYes: (file, cb, obj) => {
		if (obj._all === undefined) {
			obj._all = '';
		}
		obj._all += String(file.contents) + '_';
		cb(null, file);
	}, flushYes: (cb, obj) => {
		console.log('\x1b[32m option flush:' + obj._all);
		cb();
	}
	})
)
.pipe(f(1, file => console.log('end:', file.path) || 1)) // Use f for logging
;
