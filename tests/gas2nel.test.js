// gas2nel.test.js
const http = require('http');
const Gas2nel = require('../src/gas2nel');

describe('Gas2nel', () => {
  let gas2nel;

  beforeEach(() => {
    gas2nel = new Gas2nel();
  });

  test('should reset metrics', () => {
    gas2nel.sentBytes = 100;
    gas2nel.receivedBytes = 200;
    gas2nel.reset();
    expect(gas2nel.sentBytes).toBe(0);
    expect(gas2nel.receivedBytes).toBe(0);
  });

  test('should set options', () => {
    gas2nel.setOptions({ include: ['metric'] });
    expect(gas2nel.options.include).toContain('metric');
  });

  test('should calculate gas from metrics', () => {
    const metrics = {
      cpuTimeMs: 10,
      cpuPercentage: 5,
      memoryRSS: 1000000,
      memoryHeapUsed: 500000,
      memoryExternal: 200000,
      sentBytes: 1000,
      receivedBytes: 2000,
      wallTimeMs: 50
    };
    const gas = gas2nel.estimateGasFromMetrics(metrics);
    expect(gas).toBeGreaterThan(0);
  });

  test('should track HTTP bandwidth', (done) => {
    const server = http.createServer((req, res) => {
      res.end('Hello World');
    }).listen(3000, async () => {
      gas2nel.trackHttpBandwidth(http.request);
      http.get('http://localhost:3000', (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          expect(gas2nel.sentBytes).toBeGreaterThan(0);
          expect(gas2nel.receivedBytes).toBeGreaterThan(0);
          server.close(done);
        });
      });
    });
  });

  test('should generate report from metrics', () => {
    const metrics = {
      cpuTimeMs: 15,
      wallTimeMs: 120,
      memoryRSS: 5 * 1024 * 1024,          // 5 MB
      memoryHeapUsed: 2 * 1024 * 1024,      // 2 MB
      memoryExternal: 512 * 1024,           // 0.5 MB
      sentBytes: 1000,
      receivedBytes: 2000
    };
    const report = gas2nel.generateReportFromMetrics(metrics);
    expect(report).toEqual({
      cpuTimeMs: 15,
      wallTimeMs: 120,
      peakMemoryRSS: '5 MB',
      memoryHeapUsed: '2 MB',
      memoryExternal: '0.5 MB',
      dataTransferred: '2.9296875 KB'
    });
  });

  test('should estimate gas with metric and report options', async () => {
    gas2nel.setOptions({ include: ['metric', 'report'] });
    const fn = () => new Promise(resolve => setTimeout(resolve, 50));
    const result = await gas2nel.estimateGas(fn);

    expect(result.gas).toBeGreaterThan(0);
    expect(result.results.success).toBe(true);
    expect(result.metric).toBeDefined();
    expect(result.report).toBeDefined();
  });

  test('should handle errors in async functions', async () => {
    const fn = async () => { throw new Error('Test error'); };
    const result = await gas2nel.estimateGas(fn);

    expect(result.results.success).toBe(false);
    expect(result.results.data).toBe('Test error');
  });
});