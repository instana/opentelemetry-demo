// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
package main

import (
	"context"
	"runtime"

	"go.opentelemetry.io/otel/metric"
)

func recordRuntimeMetrics(meter metric.Meter) error {
	// Create metric instruments
	gcPause, err := meter.Float64ObservableGauge("go_gc_pause")
	if err != nil {
		return err
	}

	allocatedMemory, err := meter.Float64ObservableGauge("go_allocated_memory")
	if err != nil {
		return err
	}

	memoryObtainedFromSystem, err := meter.Float64ObservableGauge("go_memory_obtained_from_system")
	if err != nil {
		return err
	}

	// Record the runtime stats periodically
	if _, err := meter.RegisterCallback(
		func(ctx context.Context, o metric.Observer) error {
			var memStats runtime.MemStats
			runtime.ReadMemStats(&memStats)

			o.ObserveFloat64(gcPause, float64(memStats.PauseTotalNs)/1e6)     // GC Pause in ms
			o.ObserveFloat64(allocatedMemory, float64(memStats.Alloc))        // Allocated Memory in B
			o.ObserveFloat64(memoryObtainedFromSystem, float64(memStats.Sys)) // Memory Obtained From System in B
			return nil
		},
		gcPause, allocatedMemory, memoryObtainedFromSystem,
	); err != nil {
		return err
	}

	return nil
}
