// meter.test.js
const http = require('http');
const Meter = require('../src/meter');

describe('Meter', () => {
  let meter;

  beforeEach(() => {
    meter = new Meter();
  });

  test('should reset metrics', () => {
    meter.sentBytes = 100;
    meter.receivedBytes = 200;
    meter.reset();
    expect(meter.sentBytes).toBe(0);
    expect(meter.receivedBytes).toBe(0);
  });

  test('should set options', () => {
    meter.setOptions({ include: ['metric'] });
    expect(meter.options.include).toContain('metric');
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
    const gas = meter.estimateGasFromMetrics(metrics);
    expect(gas).toBeGreaterThan(0);
  });

  test('should track HTTP bandwidth', (done) => {
    const server = http.createServer((req, res) => {
      res.end('Hello World');
    }).listen(3000, async () => {
      meter.trackHttpBandwidth(http.request);
      http.get('http://localhost:3000', (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          expect(meter.sentBytes).toBeGreaterThan(0);
          expect(meter.receivedBytes).toBeGreaterThan(0);
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
    const report = meter.generateReportFromMetrics(metrics);
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
    meter.setOptions({ include: ['metric', 'report'] });
    const fn = () => new Promise(resolve => setTimeout(resolve, 50));
    const result = await meter.estimateGas(fn);

    expect(result.gas).toBeGreaterThan(0);
    expect(result.results.success).toBe(true);
    expect(result.metric).toBeDefined();
    expect(result.report).toBeDefined();
  });

  test('should handle errors in async functions', async () => {
    const fn = async () => { throw new Error('Test error'); };
    const result = await meter.estimateGas(fn);

    expect(result.results.success).toBe(false);
    expect(result.results.data).toBe('Test error');
  });
});