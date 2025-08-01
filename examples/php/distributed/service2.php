<?php
// SPDX-License-Identifier: Apache-2.0

require '../otel/autoload.php';
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\Context\Context;
use Opentelemetry\Contrib\Propagation\Instana\InstanaPropagator;
use OpenTelemetry\SDK\Registry;
use OpenTelemetry\SDK\Trace\SpanProcessor\SimpleSpanProcessor;
use OpenTelemetry\SDK\Trace\TracerProvider;

// Get a tracer
$tracer = \OpenTelemetry\API\Globals::tracerProvider()->getTracer('service2-tracer');

// Start a span for Service 2
$span = $tracer->spanBuilder('service2-request')->startSpan();
$scope=$span->activate();

// Simulate some work
sleep(1);
$headers = getallheaders();  // This function gets all HTTP headers sent to the script

// Print incoming request headers (for debugging)
echo "Received Headers from Service1.php:\n";
print_r($headers);

$context = InstanaPropagator::getInstance()->extract($headers);
$span = $tracer->spanBuilder('Service2')
    ->setParent($context)
    ->setSpanKind(SpanKind::KIND_SERVER)
    ->startSpan();
// Call Service 3
$scope = $span->activate();

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "http://localhost:8003/service3.php");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
$output = curl_exec($ch);
curl_close($ch);

echo "Service 2 received response from Service 3: " . $output . "\n";

// End the span
$span->end();
$scope->detach();
