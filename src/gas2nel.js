/**
 * @title Gas2nel Class
 * @dev A robust utility for tracking resource metrics during asynchronous function execution,
 * with a realistic "gas" cost estimation based on CPU, memory, network, and file I/O usage.
 *
 * @example
 * const { Gas2nel } = require('./Gas2nel');
 * const gas2nel = new Gas2nel({ include: ["metric", "report"] });
 *
 * async function exampleFn() {
 *   // Simulated asynchronous operation
 *   return 'Completed';
 * }
 *
 * (async () => {
 *   const result = await gas2nel.estimateGas(exampleFn);
 *   console.log(result);
 * })();
 */

const http = require('http');
const fs = require('fs');
const EventEmitter = require('events');

class Gas2nel extends EventEmitter {
  /**
   * @property {object} #metricWeights - Private weight coefficients for each tracked metric.
   * These values adjust the impact of each metric on the final gas estimation.
   */
  #metricWeights = {
    cpuTimeMs: 0.35,
    cpuPercentage: 0.2,
    memoryRSS: 0.15,
    memoryHeapUsed: 0.1,
    memoryExternal: 0.05,
    sentBytes: 0.05,
    receivedBytes: 0.05,
    wallTimeMs: 0.05,
  };

  constructor(options = {}) {
    super();
    this.options = options;
    this.reset(); // Initialize bandwidth and file I/O metrics
  }

  /**
   * Resets network and file I/O counters to zero
   * @return {void}
   */
  reset() {
    this.sentBytes = 0; // Tracks total bytes sent via HTTP requests
    this.receivedBytes = 0; // Tracks total bytes received via HTTP requests
    this.fileReadBytes = 0; // Tracks total bytes read from file system
    this.fileWriteBytes = 0; // Tracks total bytes written to file system
  }

  /**
   * Sets tracking options, e.g., to include specific metrics or generate reports
   * @param {object} options - Configuration options for tracking behavior
   * @returns {Gas2nel} - Returns the instance for chaining
   */
  setOptions(options) {
    this.options = { ...this.options, ...options };
    return this;
  }

  /**
   * Runs the function `fn`, captures metrics, and estimates gas usage based on those metrics.
   * @param {function} fn - Async function to monitor for resource usage
   * @param {...any} args - Arguments for the async function `fn`
   * @returns {object} - Object containing success status, data, gas estimate, metrics, and optional report
   */
  async estimateGas(fn, ...args) {
    const { result, error, metrics } = await this.#captureMetrics(fn, ...args);
    const gas = this.#estimateRealisticGas(metrics);

    const output = {
      success: !error,
      data: error ? error.message : result,
      gas,
    };

    if (this.options.include) {
      if (this.options.include.includes("metric")) output.metric = metrics;
      if (this.options.include.includes("report")) output.report = this.#generateReport(metrics);
    }

    return output;
  }

  /**
   * Tracks resources used by `fn`, including CPU, memory, and network I/O.
   * Also overrides methods for HTTP bandwidth and file read/write monitoring.
   * @private
   * @param {function} fn - Async function to monitor
   * @param {...any} args - Arguments for `fn`
   * @returns {object} - Object containing result, error, and recorded metrics
   */
  async #captureMetrics(fn, ...args) {
    this.reset();
    const startCpu = process.cpuUsage(); // Record initial CPU state
    const startMem = process.memoryUsage(); // Record initial memory usage
    const startTime = process.hrtime.bigint(); // Record start time for wall time measurement

    // Preserve original methods to restore after tracking
    const originalRequest = http.request;
    const originalReadFile = fs.readFile;
    const originalWriteFile = fs.writeFile;

    // Override methods for tracking HTTP and file I/O
    http.request = this.#trackHttpBandwidth(originalRequest);
    fs.readFile = this.#trackFileRead(originalReadFile);
    fs.writeFile = this.#trackFileWrite(originalWriteFile);

    let result, error;
    try {
      result = await fn(...args); // Execute the function
    } catch (err) {
      error = err;
    }

    // Restore original methods
    http.request = originalRequest;
    fs.readFile = originalReadFile;
    fs.writeFile = originalWriteFile;

    // Capture post-execution metrics
    const endCpu = process.cpuUsage(startCpu);
    const endMem = process.memoryUsage();
    const endTime = process.hrtime.bigint();

    const metrics = {
      cpuTimeMs: endCpu.user / 1000, // Convert to milliseconds
      wallTimeMs: Number((endTime - startTime) / BigInt(1e6)), // Wall time in ms
      memoryHeapUsed: endMem.heapUsed - startMem.heapUsed,
      memoryRSS: endMem.rss - startMem.rss,
      memoryExternal: endMem.external - startMem.external,
      cpuPercentage: (Number(endCpu.user) / Number(endTime - startTime)) * 100,
      sentBytes: this.sentBytes,
      receivedBytes: this.receivedBytes,
      fileReadBytes: this.fileReadBytes,
      fileWriteBytes: this.fileWriteBytes,
    };

    return { result, error, metrics };
  }

  /**
   * Estimates gas cost by weighing normalized metrics values according to metricWeights.
   * @private
   * @param {object} metrics - Resource usage metrics
   * @returns {number} - Estimated gas cost
   */
  #estimateRealisticGas(metrics) {
    let gasEstimation = 0;
    for (const [metric, weight] of Object.entries(this.#metricWeights)) {
      const value = metrics[metric];
      if (value !== undefined && typeof value === 'number') {
        const normalizedValue = this.#normalizeMetric(metric, value);
        gasEstimation += normalizedValue * weight;
      }
    }
    return gasEstimation;
  }

  /**
   * Normalizes metric values by dividing by assumed maximums for realistic scaling
   * @private
   * @param {string} metric - Metric name
   * @param {number} value - Raw metric value
   * @returns {number} - Normalized value
   */
  #normalizeMetric(metric, value) {
    const maxValues = {
      cpuTimeMs: 10000, // 10 seconds
      wallTimeMs: 1000, // 1 second
      memoryHeapUsed: 500 * 1024 * 1024, // 500 MB
      memoryRSS: 1000 * 1024 * 1024, // 1 GB
      memoryExternal: 100 * 1024 * 1024, // 100 MB
      cpuPercentage: 100, // 100% CPU
      sentBytes: 10 * 1024 * 1024, // 10 MB
      receivedBytes: 10 * 1024 * 1024, // 10 MB
      fileReadBytes: 20 * 1024 * 1024, // 20 MB
      fileWriteBytes: 20 * 1024 * 1024, // 20 MB
    };
    return value / (maxValues[metric] || 1);
  }

  /**
   * Generates a human-readable report from collected metrics
   * @private
   * @param {object} metrics - Resource usage metrics
   * @returns {object} - Report summarizing metric details
   */
  #generateReport(metrics) {
    return {
      cpuTimeMs: metrics.cpuTimeMs,
      wallTimeMs: metrics.wallTimeMs,
      peakMemoryRSS: `${(metrics.memoryRSS / (1024 ** 2)).toFixed(2)} MB`,
      memoryHeapUsed: `${(metrics.memoryHeapUsed / (1024 ** 2)).toFixed(2)} MB`,
      memoryExternal: `${(metrics.memoryExternal / (1024 ** 2)).toFixed(2)} MB`,
      networkTransferred: `${((metrics.sentBytes + metrics.receivedBytes) / 1024).toFixed(2)} KB`,
      fileIO: `${((metrics.fileReadBytes + metrics.fileWriteBytes) / 1024).toFixed(2)} KB`
    };
  }

  /**
   * Overrides http.request to monitor network traffic for bandwidth tracking
   * @private
   * @param {function} originalRequest - Original http.request function
   * @returns {function} - Wrapped http.request with bandwidth tracking
   */
  #trackHttpBandwidth(originalRequest) {
    return (...args) => {
      const req = originalRequest.apply(this, args);
      req.on('socket', socket => {
        socket.on('data', chunk => this.receivedBytes += chunk.length);
        req.write = ((originalWrite) => (chunk, encoding, callback) => {
          if (chunk) this.sentBytes += Buffer.byteLength(chunk, encoding);
          return originalWrite.call(req, chunk, encoding, callback);
        })(req.write);
      });
      return req;
    };
  }

  /**
   * Overrides fs.readFile to track file read operations
   * @private
   * @param {function} originalReadFile - Original fs.readFile function
   * @returns {function} - Wrapped fs.readFile with read tracking
   */
  #trackFileRead(originalReadFile) {
    return (path, options, callback) => {
      originalReadFile(path, options, (err, data) => {
        if (!err && data) this.fileReadBytes += data.length;
        callback(err, data);
      });
    };
  }

  /**
   * Overrides fs.writeFile to track file write operations
   * @private
   * @param {function} originalWriteFile - Original fs.writeFile function
   * @returns {function} - Wrapped fs.writeFile with write tracking
   */
  #trackFileWrite(originalWriteFile) {
    return (path, data, options, callback) => {
      if (data) this.fileWriteBytes += Buffer.byteLength(data);
      originalWriteFile(path, data, options, callback);
    };
  }
}

module.exports = Gas2nel;
