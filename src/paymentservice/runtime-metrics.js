// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
const {metrics} = require('@opentelemetry/api');
const process = require('process');
const v8 = require('v8');
const perf_hooks = require('perf_hooks');
const { monitorEventLoopDelay } = require('perf_hooks');

const meter = metrics.getMeter('paymentservice');
// new metrics
// GC Metrics tracking
let minorGcCount = 0;
let majorGcCount = 0;
let lastGcPause = 0;
let heapSizeAfterGc = 0;

// Create observable gauges for all metrics
const gcPauseGauge = meter.createObservableGauge('nodejs.gc.gcPause', {
  description: 'GC Pause in milliseconds',
  unit: 'ms',
});

const activeHandlesGauge = meter.createObservableGauge('nodejs.activeHandles', {
  description: 'Number of active handles',
  unit: '{handles}',
});

const activeRequestsGauge = meter.createObservableGauge('nodejs.activeRequests', {
  description: 'Number of active requests',
  unit: '{requests}',
});

const minorGcsGauge = meter.createObservableGauge('nodejs.gc.minorGcs', {
  description: 'Number of minor GCs',
  unit: '{gcs}',
});

const majorGcsGauge = meter.createObservableGauge('nodejs.gc.majorGcs', {
  description: 'Number of major GCs',
  unit: '{gcs}',
});

const rssGauge = meter.createObservableGauge('nodejs.memory.rss', {
  description: 'Resident Set Size',
  unit: 'bytes',
});

const heapUsedGauge = meter.createObservableGauge('nodejs.memory.heapUsed', {
  description: 'Heap Size Used',
  unit: 'bytes',
});

const heapSizeAfterGcGauge = meter.createObservableGauge('nodejs.gc.usedHeapSizeAfterGc', {
  description: 'Heap Size After GC',
  unit: 'bytes',
});

// Event Loop Metrics
const eventLoopMaxGauge = meter.createObservableGauge('nodejs.libuv.max', {
  description: 'Longest time spent in a single loop',
  unit: 'ms',
});

const eventLoopSumGauge = meter.createObservableGauge('nodejs.libuv.sum', {
  description: 'Total time spent in loop',
  unit: 'ms',
});

const eventLoopLagGauge = meter.createObservableGauge('nodejs.libuv.lag', {
  description: 'Event loop lag',
  unit: 'ms',
});

const eventLoopCountGauge = meter.createObservableGauge('nodejs.libuv.num', {
  description: 'Loops per second',
  unit: '{loops}',
});

// Heap Spaces Metrics
const heapSpacesUsedGauge = meter.createObservableGauge('nodejs.heapSpaces.used', {
  description: 'Heap Spaces Used',
  unit: 'bytes',
});

const heapSpacesAvailableGauge = meter.createObservableGauge('nodejs.heapSpaces.available', {
  description: 'Heap Spaces Available',
  unit: 'bytes',
});

const heapSpacesCurrentGauge = meter.createObservableGauge('nodejs.heapSpaces.current', {
  description: 'Heap Spaces Current',
  unit: 'bytes',
});

const heapSpacesPhysicalGauge = meter.createObservableGauge('nodejs.heapSpaces.physical', {
  description: 'Heap Spaces Physical',
  unit: 'bytes',
});

// Set up performance observer for GC events
const obs = new perf_hooks.PerformanceObserver((list) => {
  const entries = list.getEntries();
  entries.forEach((entry) => {
    // Update GC metrics based on the type of GC
    if (entry.kind === perf_hooks.constants.NODE_PERFORMANCE_GC_MAJOR) {
      majorGcCount++;
    } else {
      minorGcCount++;
    }
    lastGcPause = entry.duration;
    heapSizeAfterGc = process.memoryUsage().heapUsed;
  });
});

// Subscribe to GC events
obs.observe({ entryTypes: ['gc'], buffered: true });

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

let globalLastState = {
  timestamp: process.hrtime.bigint(),
  count: histogram.count,
  sum: histogram.mean * histogram.count,
  lastCollection: Date.now()
};

function eventLoopCollectMetrics() {
  const attributes = { type: 'loops' };
  const now = Date.now();
  
  const timeSinceLastCollection = now - globalLastState.lastCollection;
  if (timeSinceLastCollection < 900) {
    return;
  }

  eventLoopMaxGauge.addCallback((observableResult) => {
    const maxValue = Math.round(histogram.max / 1e6 * 1000) / 1000;
    observableResult.observe(maxValue, attributes);
  });

  eventLoopSumGauge.addCallback((observableResult) => {
    const currentState = {
      timestamp: process.hrtime.bigint(),
      count: histogram.count,
      sum: histogram.mean * histogram.count
    };

    const deltaTime = Number(currentState.timestamp - globalLastState.timestamp) / 1e9;
    const deltaSum = (currentState.sum - globalLastState.sum) / 1e6;

    if (deltaTime >= 0.9) {
      const timePerSecond = deltaSum / deltaTime;
      observableResult.observe(timePerSecond, attributes);
      globalLastState.sum = currentState.sum;
      globalLastState.timestamp = currentState.timestamp;
    }
  });

  eventLoopLagGauge.addCallback((observableResult) => {
    const lagValue = Math.round(histogram.mean / 1e6 * 1000) / 1000;
    observableResult.observe(lagValue, attributes);
  });

  eventLoopCountGauge.addCallback((observableResult) => {
    const currentCount = histogram.count;
    const deltaTime = Number(process.hrtime.bigint() - globalLastState.timestamp) / 1e9;
    const deltaCount = currentCount - globalLastState.count;

    if (deltaTime >= 0.9) {
      const loopsPerSecond = Math.round(deltaCount / deltaTime);
      observableResult.observe(loopsPerSecond, attributes);
      globalLastState.count = currentCount;
    }
  });

  globalLastState.lastCollection = now;

}

// Set up callbacks for all observable metrics
function setupRuntimeMetrics() {
  // Memory metrics callback
  const memoryCallback = (observableResult) => {
    const memoryUsage = process.memoryUsage();
    observableResult.observe(memoryUsage.rss, { type: 'rss' });
    observableResult.observe(memoryUsage.heapUsed, { type: 'heapUsed' });
  };

  // Active handles and requests callback
  const handleCallback = (observableResult) => {
    observableResult.observe(process._getActiveHandles().length, { type: 'handles' });
    observableResult.observe(process._getActiveRequests().length, { type: 'requests' });
  };

  // GC metrics callback
  const gcCallback = (observableResult) => {
    observableResult.observe(minorGcCount, { type: 'minor' });
    observableResult.observe(majorGcCount, { type: 'major' });
    observableResult.observe(lastGcPause, { type: 'pause' });
    observableResult.observe(heapSizeAfterGc, { type: 'heapAfterGc' });
  };

  // Heap spaces callback
  const heapSpacesCallback = (observableResult) => {
    const heapSpaces = v8.getHeapSpaceStatistics();
    heapSpaces.forEach(space => {
      const attributes = { space: space.space_name };
      observableResult.observe(space.space_used_size, { ...attributes, metric: 'used' });
      observableResult.observe(space.space_available_size, { ...attributes, metric: 'available' });
      observableResult.observe(space.space_size, { ...attributes, metric: 'current' });
      observableResult.observe(space.physical_space_size, { ...attributes, metric: 'physical' });
    });
  };

  // Register all callbacks
  rssGauge.addCallback(memoryCallback);
  heapUsedGauge.addCallback(memoryCallback);
  activeHandlesGauge.addCallback(handleCallback);
  activeRequestsGauge.addCallback(handleCallback);
  minorGcsGauge.addCallback(gcCallback);
  majorGcsGauge.addCallback(gcCallback);
  gcPauseGauge.addCallback(gcCallback);
  heapSizeAfterGcGauge.addCallback(gcCallback);
  
  heapSpacesUsedGauge.addCallback(heapSpacesCallback);
  heapSpacesAvailableGauge.addCallback(heapSpacesCallback);
  heapSpacesCurrentGauge.addCallback(heapSpacesCallback);
  heapSpacesPhysicalGauge.addCallback(heapSpacesCallback);

  eventLoopCollectMetrics();
}

module.exports = {
  setupRuntimeMetrics
};
