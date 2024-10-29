# Gas2nel

A robust Node.js utility for tracking and estimating resource costs ("gas") during asynchronous function execution. Gas2nel monitors CPU usage, memory allocation, network I/O, and file system operations to provide realistic resource utilization metrics.

[![npm version](https://badge.fury.io/js/gas2nel.svg)](https://badge.fury.io/js/gas2nel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔍 Comprehensive resource tracking
  - CPU time and percentage
  - Memory usage (RSS, heap, external)
  - Network bandwidth (sent/received bytes)
  - File I/O operations
- 📊 Configurable metric reporting
- ⚡ Real-time resource monitoring
- 🎯 Accurate gas cost estimation
- 🔄 Event-driven architecture
- 💪 TypeScript-friendly API

## Installation

```bash
npm install gas2nel
```

## Quick Start

```javascript
const Gas2nel = require('gas2nel');

// Initialize with optional configuration
const gas2nel = new Gas2nel({
  include: ["metric", "report"]  // Include detailed metrics and human-readable report
});

// Example async function to monitor
async function complexOperation() {
  const data = await fetch('https://api.example.com/data');
  await processData(data);
  return 'Operation completed';
}

// Estimate gas usage
const result = await gas2nel.estimateGas(complexOperation);
console.log(result);
```

## Configuration Options

The Gas2nel constructor accepts an options object with the following properties:

```javascript
{
  include: string[]  // Array of additional outputs to include: "metric" and/or "report"
}
```

## API Reference

### `new Gas2nel(options?)`

Creates a new Gas2nel instance.

```javascript
const gas2nel = new Gas2nel({
  include: ["metric", "report"]
});
```

### `async estimateGas(fn, ...args)`

Executes a function while monitoring resource usage and returns detailed metrics.

Parameters:
- `fn`: Async function to monitor
- `...args`: Arguments to pass to the function

Returns:
```javascript
{
  success: boolean,      // Whether the function executed successfully
  data: any,            // Function return value or error message
  gas: number,          // Estimated gas cost (0 to 1 scale)
  metric?: {            // Optional detailed metrics
    cpuTimeMs: number,
    cpuPercentage: number,
    memoryRSS: number,
    memoryHeapUsed: number,
    memoryExternal: number,
    sentBytes: number,
    receivedBytes: number,
    wallTimeMs: number,
    fileReadBytes: number,
    fileWriteBytes: number
  },
  report?: {            // Optional human-readable report
    cpuTimeMs: number,
    wallTimeMs: number,
    peakMemoryRSS: string,
    memoryHeapUsed: string,
    memoryExternal: string,
    networkTransferred: string,
    fileIO: string
  }
}
```

### `setOptions(options)`

Updates the configuration options.

```javascript
gas2nel.setOptions({
  include: ["report"]
});
```

### `reset()`

Resets all counters (network and file I/O metrics).

```javascript
gas2nel.reset();
```

## Gas Estimation Details

Gas2nel uses a weighted combination of various metrics to estimate the total resource cost:

| Metric | Weight | Description |
|--------|---------|-------------|
| CPU Time | 35% | Process CPU time in milliseconds |
| CPU Percentage | 20% | CPU utilization percentage |
| RSS Memory | 15% | Resident Set Size memory usage |
| Heap Memory | 10% | V8 heap memory usage |
| External Memory | 5% | V8 external memory usage |
| Network Sent | 5% | Bytes sent over network |
| Network Received | 5% | Bytes received over network |
| Wall Time | 5% | Total execution time |

## Examples

### Basic Usage

```javascript
const Gas2nel = require('gas2nel');
const gas2nel = new Gas2nel();

async function example() {
  // CPU-intensive operation
  const result = await gas2nel.estimateGas(async () => {
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += Math.sqrt(i);
    }
    return sum;
  });
  
  console.log(result);
}
```

### Network Operations

```javascript
const gas2nel = new Gas2nel({ include: ["metric"] });

const result = await gas2nel.estimateGas(async () => {
  const response = await fetch('https://api.example.com/data');
  return await response.json();
});

console.log(`Network usage: ${result.metric.sentBytes + result.metric.receivedBytes} bytes`);
```

### File Operations

```javascript
const gas2nel = new Gas2nel({ include: ["report"] });

const result = await gas2nel.estimateGas(async () => {
  await fs.promises.writeFile('output.txt', 'Hello World');
  const data = await fs.promises.readFile('output.txt');
  return data.toString();
});

console.log(`File I/O: ${result.report.fileIO}`);
```

## Error Handling

Gas2nel gracefully handles errors in monitored functions:

```javascript
const result = await gas2nel.estimateGas(async () => {
  throw new Error('Something went wrong');
});

console.log(result);
// {
//   success: false,
//   data: 'Something went wrong',
//   gas: 0.023,  // Resources used before error
//   ...
// }
```

## Best Practices

1. **Reset Between Operations**
   ```javascript
   gas2nel.reset();  // Clear previous metrics
   ```

2. **Include Appropriate Metrics**
   ```javascript
   // For debugging
   gas2nel.setOptions({ include: ["metric", "report"] });
   
   // For production
   gas2nel.setOptions({});  // Minimal output
   ```

3. **Monitor Specific Operations**
   ```javascript
   // Good: Monitoring specific operation
   await gas2nel.estimateGas(specificOperation);
   
   // Avoid: Monitoring too much
   await gas2nel.estimateGas(async () => {
     await operation1();
     await operation2();
     await operation3();
   });
   ```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.