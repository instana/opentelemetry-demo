<?php
// SPDX-License-Identifier: Apache-2.0

require  '../otel/autoload.php';

use OpenTelemetry\SDK\Registry;
use OpenTelemetry\SDK\Trace\SpanProcessor\SimpleSpanProcessor;
use OpenTelemetry\SDK\Trace\TracerProvider;
use OpenTelemetry\API\Trace\Propagation\TraceContextPropagator;
use OpenTelemetry\Context\Context;
use OpenTelemetry\SDK\Sdk;

// Get a tracer
$tracerProvider = new TracerProvider(
    new SimpleSpanProcessor(
        Registry::spanExporterFactory("instana")->create())
);

$tracer = $tracerProvider->getTracer('Root span');

// Start a span for Service 2
$rootspan = $tracer->spanBuilder('Root Span')->startSpan();
$scope=$rootspan->activate();


$ch = curl_init();

$url = "http://localhost:8004";
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true); 
    
$response = curl_exec($ch);
curl_close($ch);
echo $response;

// End the span
$rootspan->end();
$scope->detach();
