const http = require('http');
const fs = require('fs');
const Gas2nel = require('../src/gas2nel');

describe('Gas2nel', () => {
  let gas2nel;

  beforeEach(() => {
    gas2nel = new Gas2nel({ include: ['metric', 'report'] });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with default options', () => {
      const defaultGas2nel = new Gas2nel();
      expect(defaultGas2nel.options).toEqual({});
    });

    test('should initialize with custom options', () => {
      const options = { include: ['metric'] };
      const customGas2nel = new Gas2nel(options);
      expect(customGas2nel.options).toEqual(options);
    });

    test('should allow updating options via setOptions', () => {
      gas2nel.setOptions({ include: ['report'] });
      expect(gas2nel.options).toEqual({ include: ['report'] });
    });
  });

  describe('Resource Tracking', () => {
    test('should track CPU and memory usage', async () => {
      const result = await gas2nel.estimateGas(async () => {
        // Simulate CPU work
        let x = 0;
        for (let i = 0; i < 1000000; i++) {
          x += Math.sqrt(i);
        }
        return x;
      });

      expect(result.success).toBe(true);
      expect(result.metric).toBeDefined();
      expect(result.metric.cpuTimeMs).toBeGreaterThan(0);
      expect(result.metric.memoryHeapUsed).toBeDefined();
      expect(result.metric.memoryRSS).toBeDefined();
    });

    test('should track HTTP bandwidth', async () => {
      const mockReq = new (require('events').EventEmitter)();
      mockReq.write = jest.fn();
      mockReq.end = jest.fn();

      jest.spyOn(http, 'request').mockImplementation(() => {
        process.nextTick(() => {
          const mockSocket = new (require('events').EventEmitter)();
          mockReq.emit('socket', mockSocket);
          mockSocket.emit('data', Buffer.from('test data'));
        });
        return mockReq;
      });

      const result = await gas2nel.estimateGas(async () => {
        const req = http.request('http://example.com');
        req.write('test request');
        req.end();
      });

      expect(result.metric.sentBytes).toBeGreaterThan(0);
      expect(result.metric.receivedBytes).toBeGreaterThan(0);
    });

    test('should track file I/O operations', async () => {
      const testData = 'test content';
      
      jest.spyOn(fs, 'readFile')
        .mockImplementation((path, options, callback) => {
          callback(null, Buffer.from(testData));
        });

      jest.spyOn(fs, 'writeFile')
        .mockImplementation((path, data, options, callback) => {
          callback(null);
        });

      const result = await gas2nel.estimateGas(async () => {
        await new Promise((resolve) => {
          fs.readFile('test.txt', 'utf8', (err, data) => {
            fs.writeFile('output.txt', data, 'utf8', () => {
              resolve();
            });
          });
        });
      });

      expect(result.metric.fileReadBytes).toBe(testData.length);
      expect(result.metric.fileWriteBytes).toBe(testData.length);
    });
  });

  describe('Error Handling', () => {
    test('should handle function errors gracefully', async () => {
      const result = await gas2nel.estimateGas(async () => {
        throw new Error('Test error');
      });

      expect(result.success).toBe(false);
      expect(result.data).toBe('Test error');
      expect(result.gas).toBeDefined();
    });

    test('should handle network errors', async () => {
      jest.spyOn(http, 'request')
        .mockImplementation(() => {
          throw new Error('Network error');
        });

      const result = await gas2nel.estimateGas(async () => {
        http.request('http://example.com');
      });

      expect(result.success).toBe(false);
      expect(result.data).toContain('Network error');
    });
  });

  describe('Report Generation', () => {
    test('should generate human-readable reports when included', async () => {
      const result = await gas2nel.estimateGas(async () => {
        // Simulate some work
        const arr = new Array(1000000).fill(0);
        return arr.map(x => x + 1);
      });

      expect(result.report).toBeDefined();
      expect(result.report.cpuTimeMs).toBeDefined();
      expect(result.report.peakMemoryRSS).toMatch(/MB$/);
      expect(result.report.memoryHeapUsed).toMatch(/MB$/);
      expect(result.report.networkTransferred).toMatch(/KB$/);
      expect(result.report.fileIO).toMatch(/KB$/);
    });

    test('should exclude metrics and report when not requested', async () => {
      gas2nel.setOptions({});
      const result = await gas2nel.estimateGas(async () => true);

      expect(result.metric).toBeUndefined();
      expect(result.report).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.gas).toBeDefined();
    });
  });

  describe('Gas Estimation', () => {
    test('should produce reasonable gas estimates', async () => {
      const lightResult = await gas2nel.estimateGas(async () => true);
      
      const heavyResult = await gas2nel.estimateGas(async () => {
        // Heavy computation
        const arr = new Array(2000000).fill(0);
        return arr.map(x => Math.sqrt(x));
      });

      expect(heavyResult.gas).toBeGreaterThan(lightResult.gas);
    });

    test('should factor in all resource types', async () => {
      jest.spyOn(fs, 'writeFile')
        .mockImplementation((path, data, options, callback) => {
          callback(null);
        });

      const result = await gas2nel.estimateGas(async () => {
        // CPU work
        let x = 0;
        for (let i = 0; i < 100000; i++) x += Math.sqrt(i);
        
        // Memory allocation
        const arr = new Array(1000000).fill(0);
        
        // File I/O
        await new Promise(resolve => {
          fs.writeFile('test.txt', 'test', 'utf8', resolve);
        });
        
        return x;
      });

      expect(result.gas).toBeGreaterThan(0);
      expect(result.metric.cpuTimeMs).toBeGreaterThan(0);
      expect(result.metric.memoryHeapUsed).toBeGreaterThan(0);
      expect(result.metric.fileWriteBytes).toBeGreaterThan(0);
    });
  });
});