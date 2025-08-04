<?php
// SPDX-License-Identifier: Apache-2.0

require '../otel/autoload.php';
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\Context\Context;
use Opentelemetry\Contrib\Propagation\Instana\InstanaPropagator;
use OpenTelemetry\SDK\Registry;
use OpenTelemetry\SDK\Trace\TracerProvider;
use OpenTelemetry\SDK\Trace\SpanProcessor\SimpleSpanProcessor;

// Get a tracer
$tracer = \OpenTelemetry\API\Globals::tracerProvider()->getTracer('service1-tracer');

$headers = getallheaders();  // This function gets all HTTP headers sent to the script

// Print incoming request headers (for debugging)
echo "Received Headers from parent\n";
print_r($headers);

$context = InstanaPropagator::getInstance()->extract($headers);
$Span = $tracer->spanBuilder('Service1')
    ->setParent($context)
    ->setSpanKind(SpanKind::KIND_SERVER)
    ->startSpan();

$scope=$Span->activate();

// Simulate some work
sleep(1);

// Call Service 2
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "http://localhost:8002/service2.php");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
$output = curl_exec($ch);
curl_close($ch);

// End the root span
$Span->end();
$scope->detach();
