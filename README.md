# wait-group-promise

An implementation of the [Go's WaitGroup](https://golang.org/pkg/sync/#WaitGroup) for Node.js.

## Installation

```
npm install --save wait-group-promise
```

## Usage

```javascript
const WaitGroup = require('wait-group-promise');

const wg = new WaitGroup();

wg.add(2);

const p = wg.wait();

setTimeout(() => {
  wg.done();
}, 5000);
  
setTimeout(() => {
  wg.done();
}, 3000);

await p;
```