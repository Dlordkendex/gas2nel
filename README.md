# Gas2nel Module

A lightweight JavaScript library for tracking and estimating resource usage metrics like CPU time, memory consumption, and network bandwidth. Ideal for applications needing performance monitoring and gas estimation based on computational costs.

## Features

- Track CPU and memory usage
- Monitor network bandwidth (sent and received bytes)
- Estimate gas (resource cost) from metrics
- Generate detailed performance reports

## Installation

Install the package via npm:

```bash
npm install gas2nel-module

Usage

Basic Example

const Gas2nel = require('gas2nel-module');

const gas2nel = new Gas2nel();

async function exampleFunction() {
  return new Promise(resolve => setTimeout(resolve, 100));
}

async function main() {
  const result = await gas2nel.estimateGas(exampleFunction);
  console.log(result);
}

main();

Setting Options

To include additional data like metrics or reports in the output:

gas2nel.setOptions({ include: ['metric', 'report'] });

const result = await gas2nel.estimateGas(exampleFunction);
console.log(result);

API

setOptions(options)

Set configuration options for the gas2nel instance.

options: Object with the following keys:

include (Array): Include additional data like metric or report in the output.



estimateGas(fn, ...args)

Estimates the gas based on resource metrics for the provided function.

fn: The function to measure.

...args: Arguments for the function.

Returns: An object containing:

results: Success status and data or error message.

gas: Estimated gas based on function execution.

metric (optional): Detailed resource metrics if include: ['metric'].

report (optional): Summary report if include: ['report'].



calculateMetrics(fn, ...args)

Calculates resource metrics for a function without estimating gas.

fn: The function to measure.

...args: Arguments for the function.

Returns: Metrics object with details on CPU, memory, and network usage.


generateReportFromMetrics(metrics)

Generates a formatted report from a metrics object.

metrics: Object containing resource metrics.

Returns: An object with CPU time, memory usage, and data transferred.


Example Tests

To run tests with Jest, add the following script to your package.json:

"scripts": {
  "test": "jest"
}

Then, create a gas2nel.test.js file for your tests (see the example in the documentation).

License

MIT License. See LICENSE for details.

Contributing

Feel free to submit issues and pull requests to contribute to the project.


---

For more details, visit the GitHub repository.