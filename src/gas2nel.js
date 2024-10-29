/**
 * @title Gas2nel Class
 * @dev Utility to measure resource metrics for asynchronous functions and estimate "gas" cost.
 *
 * @example
 * const { Gas2nel } = require('./Gas2nel');
 * const gas2nel = new Gas2nel().setOptions({ include: ["metric", "report"] });
 *
 * async function exampleFn() {
 *   // Some async operation
 *   return 'Completed';
 * }
 *
 * (async () => {
 *   const result = await gas2nel.estimateGas(exampleFn);
 *   console.log(result);
 * })();
 */

const http = require('http');
const EventEmitter = require('events');

class Gas2nel extends EventEmitter {
  constructor() {
    super();
    this.reset();
    this.options = {};
  }

  reset() {
    this.sentBytes = 0;
    this.receivedBytes = 0;
  }

  metricWeights = new Map([
    ['cpuTimeMs', 25.0],
    ['cpuPercentage', 20.0],
    ['memoryRSS', 18.0],
    ['memoryHeapUsed', 10.0],
    ['memoryExternal', 8.0],
    ['sentBytes', 8.0],
    ['receivedBytes', 8.0],
    ['wallTimeMs', 3.0]
  ]);

  setOptions(options) {
    this.options = { ...this.options, ...options };
    return this;
  }

  estimateGasFromMetrics(metrics) {
    let gasEstimation = 0;
    for (const [metric, weight] of this.metricWeights) {
      const value = metrics[metric];
      if (value !== undefined && typeof value === 'number') {
        gasEstimation += value * (weight / 100);
      }
    }
    return gasEstimation;
  }

  async #calculateMetrics(fn, ...args) {
    this.reset();
    const startCpu = process.cpuUsage();
    const startMem = process.memoryUsage();
    const startTime = process.hrtime.bigint();

    const originalRequest = http.request;
    http.request = this.trackHttpBandwidth(originalRequest);

    let result, error;
    try {
      result = await fn(...args);
    } catch (err) {
      error = err;
    }

    http.request = originalRequest;

    const endCpu = process.cpuUsage(startCpu);
    const endMem = process.memoryUsage();
    const endTime = process.hrtime.bigint();

    const metrics = {
      cpuTimeMs: endCpu.user / 1000,
      wallTimeMs: Number((endTime - startTime) / BigInt(1e6)),
      memoryHeapUsed: endMem.heapUsed - startMem.heapUsed,
      memoryRSS: endMem.rss - startMem.rss,
      memoryExternal: endMem.external - startMem.external,
      cpuPercentage: (BigInt(endCpu.user) * 100n) / (endTime - startTime),
      sentBytes: this.sentBytes,
      receivedBytes: this.receivedBytes
    };

    return { result, error, metrics };
  }

  async estimateGas(fn, ...args) {
    const measurement = await this.#calculateMetrics(fn, ...args);
    const gas = this.estimateGasFromMetrics(measurement.metrics);
    const options = this.options;
    const output = {
      results: {
        success: !measurement.error,
        data: measurement.error ? measurement.error.message : measurement.result
      },
      gas,
    };
    if (options?.include) {
      if (options.include.includes("metric")) output.metric = measurement.metrics;
      if (options.include.includes("report")) output.report = this.generateReportFromMetrics(measurement.metrics);
    }
    return output;
  }

  async calculateMetrics(fn, ...args) {
    const measurement = await this.#calculateMetrics(fn, ...args);
    return measurement.metrics;
  }

  trackHttpBandwidth(originalRequest) {
    return (...reqArgs) => {
      const req = originalRequest.apply(this, reqArgs);
      req.on('socket', socket => {
        socket.on('data', chunk => this.receivedBytes += chunk.length);
        const originalWrite = req.write;
        req.write = (chunk, encoding, callback) => {
          if (chunk) this.sentBytes += Buffer.byteLength(chunk, encoding);
          return originalWrite.call(req, chunk, encoding, callback);
        };
      });
      return req;
    };
  }

  generateReportFromMetrics(metrics) {
    return {
      cpuTimeMs: metrics.cpuTimeMs,
      wallTimeMs: metrics.wallTimeMs,
      peakMemoryRSS: `${metrics.memoryRSS / (1024 ** 2)} MB`,
      memoryHeapUsed: `${metrics.memoryHeapUsed / (1024 ** 2)} MB`,
      memoryExternal: `${metrics.memoryExternal / (1024 ** 2)} MB`,
      dataTransferred: `${(metrics.sentBytes + metrics.receivedBytes) / 1024} KB`
    };
  }
}

module.exports = Gas2nel;