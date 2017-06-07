# gulp-ab-filter
Используйте для фильтрации и разделения потоков из [vinyl] объектов.
Есть только одна внешняя зависимость [minimatch].
Легко соединяйте плагины в цепочки для каждой ветви.
Создавайте свои функции-обработчики объектов, в том числе с возможностью накопления и сброса в поток.

## Установка

```sh
$ npm install -D gulp-ab-filter
```

## API

### Основной модуль
---
```javascript
// Импорт
const gulp = require('gulp');
const ab = require('gulp-ab-filter');
```

#### Использование как `фильтр` потока [vinyl] объектов.
Дальше проходят только объекты для которых условие истина.
Здесь используется стандартный поток `out`.

```
(input) --> <condition === true || Out> --> (Out)
```
*Внимание: если условие - функция которая возвращает имя потока, то объекты попадут в него*

*Примечание: на схемах потоки изображены со стандартными именами.*

```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition[, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

##### condition (условие) [см. match](#match)
##### options (опции)
```javascript
{
  // возможные опции со значениями по умолчанию
  yes: 'Yes',           // имя стандартного потока yes
  no: 'No',             // имя стандартного потока no
  out: 'Out'            // имя стандартного потока выхода
  debug: false,         // включение режима отладки для контроля прохождения объектов
  end: undefined,       // обработчик конца всех потоков
  endName: undefined,   // обработчик конца потока с указанным именем, заменяет end обработчик
  flush: undefined,     // обработчик сброса всех потоков
  flushName: undefined, // обработчик сброса потока с указанным именем, заменяет flush обработчик
  minimatch: undefined  // minimatch опции которые применяются для условия
}
```

#### <a name="end"></a>`Фильтр` с использованием обработчика конца.
Используется стандартный выходной поток, т.к. объекты сразу попадают туда.
Первым параметром обработчика является объект [vinyl].
Второй параметр это функция обратного вызова, которая должна быть обязательно вызвана с параметрами: null или ошибка и файл.
Если параметры опускаются, то файл не передается далее.
Третий параметр для обработчика конца `obj` это объект контекста.
Он содержит два свойства: n - имя потока и s - ссылка на поток.
Поток поддерживает команду push.

```
(input) --> <condition === true || Out> --> (Out --> [endOut || end])
```
*Внимание: если условие - функция которая возвращает имя потока, то объекты попадут в него.
Если есть именованный обработчик конца, то основной обработчик не будет вызываться в этом потоке.*

```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, {end: (object, cb) => {
    func1(object); // func1 обрабатывает объект: меняет имя, содержимое и т.д.
    cb(null, object);
  }})
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### `Фильтр` с использованием обработчиков конца и сброса потока.
Параметры обработчика сброса такие как у [обработчика конца](#end), только без первого.
Пример показывает как можно соединить файлы потока в новый файл. При этом дальше проходит только новый файл.

```
(input) -> <condition === true || Out> --> (Out -> [endOut || end][flushOut || flush])
```
*Внимание: если условие - функция которая возвращает имя потока, то объекты попадут в него.
Если есть именованный обработчик конца, то основной обработчик не будет вызываться в этом потоке.*

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
      cb(); // здесь блокируем передачу файла
    }, flush: (cb, obj) => {
      obj._result && obj.s.push(obj._result); // передаем результат
      cb();
    }
  })
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

#### Использование в качестве `разделителя` потока [vinyl] объектов со стандартным потоком `yes`.
Объекты для которых условие true, попадают в поток `yes` и далее на выход в поток `out`,
остальные сразу на выход в поток `out`.

```
(input) -> <condition === true || Yes> --> (Yes) --> (Out)
           <Else> -------------------------------------^
```
*Внимание: если условие - функция, которая возвращает имя потока, то объекты попадут в него*

```javascript
const yes = [plugin1(parameters), plugin2(parameters),
  (object, cb) => {
    // действия с объектом, см. примеры в test.js
    cb(null, object); // обязательный запуск функции обратного вызова
  }, plugin3(parameters) ];
    // повторное использование `yes` недопустимо!
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, yes [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```
#####  <a name="Yes"></a>yes - это труба, которая может быть:
* стандартный gulp плагин
* функция мини плагин, см. обработчик [end](#end)
* массив из первого и второго в любом сочетании. Выполнение осуществляется в указанном порядке.
Это позволяет строить динамические цепочки плагинов.

*Внимание! Труба может быть использована только один раз.*

#### Использование в качестве `разделителя` потока [vinyl] объектов со стандартным потоком `yes` и `no`.
Объекты для которых условие true, попадают в поток yes и далее на выход в поток `out`,
остальные попадают в поток `no` и далее на выход в поток `out`.

```
(input) -> <condition === true || Yes> --> (Yes) --> (Out)
           <Else> --> (No) ----------------------------^
```
*Внимание: если условие - функция, которая возвращает имя потока, то объекты попадут в него*

```javascript
gulp.src('source/**/*.js')
  .pipe(pluginA())
  .pipe(gulp.dest('debug/js'))
  .pipe(ab(condition, yes, no, [, options]))
  .pipe(pluginB())
  .pipe(gulp.dest('production/js'))
```

##### no - то-же что и [`yes`](#Yes)

##### `Разделитель` потока [vinyl] объектов со стандартным потоком `yes` и обработчиком конца.

```
(input) -> <condition === true || Yes> --> (Yes [endYes || end]) --> (Out --> [endOut || end])
           <Else> -----------------------------------------------------^
```
*Внимание: Если условие - функция, которая возвращает имя потока, то объекты попадут в него.
Если есть именованный обработчик конца, то основной обработчик не будет вызываться в этом потоке.*

```javascript
gulp.src('source/**/*.js')
  .pipe(ab(condition, yes , {end: (object, cb, obj) => {
    // сюда попадут все файлы, и yes и out потоков
    if(obj.n === 'Yes') { // check name of stream
	  // некие действия с объектом
    }
    cb(null, object); // либо просто cb() если не хотим передавать файл дальше
  }}))
  .pipe(pluginA())
  .pipe(gulp.dest('production/js'))
```
```javascript
// пример с именованным обработчиком конца
gulp.src('source/**/*.js')
  .pipe(ab(condition, yes , {endYes: (object, cb, obj) => {
    // а сюда попадут только файлы из yes потока
    // некие действия с объектом
    cb(null, object); // либо просто cb() если не хотим передавать файл дальше
  }, end: (object, cb, obj) => {
    // сюда попадут только файлы из out потока
    // этот обработчик можно и опустить если нет в этом необходимости
    // некие действия с объектом
    cb(null, object); // либо просто cb() если не хотим передавать файл дальше
  }}))
  .pipe(pluginA())
  .pipe(gulp.dest('production/js'))
```

#### `Разделитель` потока [vinyl] объектов с использованием массива именованных каналов.
Объекты, для которых условие Истина, попадают в поток `yes` и далее в `out`,
иначе если условие равняется имени потока, то объекты попадают в этот поток далее в `out`.
Иначе они попадают в поток `no` и далее в `out`.

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
##### n: name1 - имя потока
##### p: pipe1 - the pipe same as [`Yes`](#Yes)
##### stop: value - если значение эквивалентно true, то объект не проходит в `out`

### relPath(object)
---
Возвращает относительный путь к [vinyl] файлу включая имя,
но без текущей директории, используя разделители posix.

```javascript
// Импорт
const ab = require('gulp-ab-filter');
// где-то ниже
let path = ab.relPath(file);
```

### <a name="match"></a>match(object, condition[, options])
---
Возвращает логическое значение или строку, если condition это функция, возвращающая не булевое значение, которое автоматически преобразуется в строку. Строка используется когда нужно оперировать именованными потоками.

```javascript
// Импорт
const match = require('gulp-ab-filter').match;
// где-то ниже
let result = match(file, condition[, options]);
```

#### object
* Это [vinyl] объект, представляющий файл или папку.
#### condition (Условие)
Возможные типы:
* Function - пользовательская функции с одним аргументом типа [vinyl].
Возвращает строку для использования с именованными потоками либо автоматически преобразуется в логическое значение.

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

* [RegExp] - регулярное выражение. Возвращает `condition.test(path)`.

```javascript
// Истина для всех js файлов заканчивающихся на z
let result = match(file, /z\.js$/);
```

* [blob] строка.

```javascript
// Истина для всех js файлов в текущей папке заканчивающихся на 1 или 2
let result = match(file, '*[1|2].js');
// Истина для всех js файлов во всех папках, начиная с текущей
let result = match(file, '**/*.js');
// Истина для всех js файлов во всех папках, начиная с текущей
let result = match(file, '*.js', {matchBase: true});
```

Использование отрицания:
```javascript
// Истина для всех файлов кроме js
let result = match(file, '!*.js', {matchBase: true});
```
* Массив из [blob] строк.
Срабатывает только первое соответствие, остальные игнорируются. Возможно использование отрицания.

```javascript
// Истина для всех js файлов кроме начинающихся с b
let result = match(file, ['!**/b*.js', '**/*.js']);
// Истина для всех js файлов кроме начинающихся с b, но не с ba
let result = match(file, ['**/ba*.js', '!**/b*.js', '**/*.js']);
```

* Прочие типы стандартно преобразуются к логическому выражению.
Например: 1 - true, 0 - false
#### options (Опции)
* [Minimatch опции] для настройки фильтрации.

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
[Minimatch опции]:github.com/isaacs/minimatch#options
[RegExp]:developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/RegExp