# gulp-ab-filter
[![npm version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Downloads][downloads-image]][downloads-url]
Используйте для фильтрации и разделения потока из [vinyl] объектов.
Легко соединяйте плагины в цепочки для каждой ветви.
Создавайте свои функции-обработчики объектов, в том числе с возможностью накопления и сброса в ветвь.

## Установка
```sh
$ npm i -D gulp-ab-filter
```

## API

### Основной модуль
```javascript
// Импорт
const gulp = require('gulp');
const ab = require('gulp-ab-filter');
```

```
ab(condition [, branches ] [, options])
     |             |            |
     |             +-> yes      +-{object}--+-> yes = Yes -|
   (types)         +-> yes, no              +-> no =  No  -+-> замена стандартных имен для ветвей
     |             +-> namedBranch []       +-> out = Out -|
     |                   / | \              +-> debug - включение режима отладки для контроля прохождения объектов
     |   {n: Name, p: Pipe, stop: Boolean}  +-> end(vinyl, cb [, obj]) - главный обработчик конца всех ветвей
     |                                      +-> flush(cb [, obj]) - главный обработчик сброса всех ветвей
     +-> RegExp ---------------------+      +-> endName - обработчик конца ветви с указанным именем, заменяет главный обработчик
     +-> blob -----------------------+      +-> flushName - обработчик сброса ветви с указанным именем, заменяет главный обработчик
     +-> blob [] --------------------+      +-> minimatch - опции которые применяются для blob condition
     +-> function(vinyl)             |
     |      |                        |
     |      +-> String result        |
     |      +-> other - convert -> --+-> Boolean result
     |                               |
     +-> other - convert ------------+
```

#### <a name="condition"></a>condition (Условие)
В [RegExp] и [blob] передается результат функции [relPath](#relPath).
Возможные типы:
* Function - пользовательская функции с одним аргументом типа [vinyl].
Возвращает строку для использования с именованными ветвями либо автоматически преобразуется в логическое значение.
* [RegExp] - регулярное выражение.
* [blob] строка.
Если [blob] начинается с `!`, то `!` отбрасывается и [blob] работает инверсионно.
* Массив из [blob] строк.
Срабатывает только первое соответствие, остальные игнорируются. Возможно использование отрицания.
Если в массиве используются только [blob] с `!` и не один не срабатывает, то это эквивалентно истине.
* Прочие типы стандартно преобразуются к логическому выражению.
Например: 1 - true, 0 - false.

#### <a name="nameB"></a>Name
Имя ветви

#### <a name="pipe"></a>Pipe
Параметр yes, no, namedBranch.p может быть:
* плагином gulp
* функцией ([vinyl], [cb](#cb) [, [obj](#obj)])
* массивом содержащим плагины gulp и функции в любых сочетаниях.

#### <a name="cb">cb
Функция обратного вызова, которая должна быть обязательно вызвана с параметрами: null или ошибка и [vinyl] объект.
Если параметры опускаются, то объект не передается далее.

#### <a name="obj">obj
Объект контекста.
Он содержит два свойства: n - [имя ветви](#nameB) и s - ссылка на поток ветви.
Поток ветви поддерживает команду push.

#### Логика работы фильтра:
1) condition в зависимости от его типа преобразуется в *result*.
2) Если параметр branches отсутствует, то используется только выходная ветвь **out**.
В нее попадают объекты для которых *result* = true либо равен имени ветви **out**.
См. [пример](#_filter).
3) Если branches есть, то объекты для которых *result* = true попадут в стандартную ветвь **yes**.
Объекты для которых *result* = false попадут в стандартную ветвь **no**.
Объекты для которых *result* типа String попадут в ветвь с именем *result* если она есть
или если ее нет то в ветвь **no** при ее наличии.
Если объект не попал ни в одну ветвь он сразу попадает в **out**.
Объекты после прохождения всех ветвей также попадают в **out**.
Если свойство namedBranch.stop === true то объекты не передаются в **out**.
4) Можно установить обработчик end. В него попадут объекты при выходе из из всех ветвей. См. [пример](#_filterEnd).
5) Можно установить обработчик end[Name](#nameB). В него попадут объекты при выходе из ветви Name.
6) Можно установить обработчик flush. Он будет вызван при очистке всех ветвей. См. [пример](#_filterEndFlush).
7) Можно установить обработчик end[Name](#nameB). Он будет вызван при очистке ветви Name.

#### Примеры использования:

#### <a name="_filter"></a>Использование как фильтр потока [vinyl] объектов.
```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition[, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_filterEnd"></a>Фильтр с использованием обработчика конца.
```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, {end: (object, cb, obj) => {
    func1(object); // func1 обрабатывает объект: меняет имя, содержимое и т.д.
    cb(null, object);
  }})
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_filterEndFlush"></a>Фильтр с использованием обработчиков конца и сброса.
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
      cb(); // здесь блокируем передачу объекта
    }, flush: (cb, obj) => {
      obj._result && obj.s.push(obj._result); // передаем результат
      cb();
    }
  })
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_yes"></a>Использование в качестве разделителя потока [vinyl] объектов со стандартной ветвью **yes**.
```javascript
const yes = [plugin1(parameters), plugin2(parameters),
  (object, cb) => {
    // действия с объектом, см. примеры в test.js
    cb(null, object); // обязательный запуск функции обратного вызова
  }, plugin3(parameters) ];
    // повторное использование yes недопустимо!
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, yes [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_yesNo">Использование в качестве разделителя потока [vinyl] объектов со стандартными ветвями **yes** и **no**.
```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, yes, no, [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_yesEnd"></a>Разделитель потока [vinyl] объектов со стандартной ветвью **yes** и обработчиком конца.
```javascript
gulp.src('source/**/*.js')
  .pipe(ab(condition, yes , {end: (object, cb, obj) => {
    // сюда попадут все файлы, и yes и out ветвей
    if(obj.n === 'Yes') { // check name of stream
	  // некие действия с объектом
    }
    cb(null, object); // либо просто cb() если не хотим передавать объект дальше
  }}))
  .pipe(pluginA())
  .pipe(gulp.dest('production/js'))
```
```javascript
// пример с именованным обработчиком конца
gulp.src('source/**/*.js')
  .pipe(ab(condition, yes , {endYes: (object, cb, obj) => {
    // а сюда попадут только файлы из yes ветви
    // некие действия с объектом
    cb(null, object); // либо просто cb() если не хотим передавать объект дальше
  }, end: (object, cb, obj) => {
    // сюда попадут только объекты из out ветви
    // этот обработчик можно и опустить если нет в этом необходимости
    // некие действия с объектом
    cb(null, object); // либо просто cb() если не хотим передавать объект дальше
  }}))
  .pipe(pluginA())
  .pipe(gulp.dest('production/js'))
```

#### <a name="_named"></a>Разделитель потока [vinyl] объектов с использованием массива именованных ветвей.
```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, [{n: 'Yes', p: pipe1}, {n: 'Name1', p: pipe2}, {n: 'Name2', p: pipe3}], [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

### <a name="relPath"></a>ab.relPath([vinyl])
Возвращает относительный путь к [vinyl] объекту включая имя,
но без текущей директории, используя разделители posix.

### ab.match([vinyl], [condition](#condition) [, [minimathOptions]])
Возвращает значение которое зависит от типа [condition](#condition).

#### Примеры использования:
```javascript
// condition как функция
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
// Истина для всех js файлов заканчивающихся на z
let result = ab.match(file, /z\.js$/);
// Истина для всех js файлов в текущей папке заканчивающихся на 1 или 2
let result = ab.match(file, '*[1|2].js');
// Истина для всех js файлов во всех папках, начиная с текущей
let result = ab.match(file, '**/*.js');
// Истина для всех js файлов во всех папках, начиная с текущей
let result = ab.match(file, '*.js', {matchBase: true});
// Использование отрицания:
// Истина для всех файлов кроме js
let result = match(file, '!*.js', {matchBase: true});
// Истина для всех js файлов кроме начинающихся с b
let result = match(file, ['!**/b*.js', '**/*.js']);
// Истина для всех js файлов кроме начинающихся с b, но не с ba
let result = match(file, ['**/ba*.js', '!**/b*.js', '**/*.js']);
```

## Сотрудничество
Пожалуйста присылайте свои доработки и улучшения. Чтобы приступить, необходимо выполнить подготовительные шаги:
```sh
git clone https://github.com/talipoff/gulp-ab-filter
cd gulp-ab-filter
npm i
```

После нужно запустить тесты:
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
