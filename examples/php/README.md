# Instana PHP Otel Tracing demo app

This repository demonstrates Instana's tracing functionality
based on [OpenTelemetry](https://opentelemetry.io/docs/languages/php/).

This example is enhanced version of [OpenTelemetry Wordpress Instrumentation](https://github.com/open-telemetry/opentelemetry-php-contrib/tree/main/examples/instrumentation/Wordpress).
This example autoinstruments the Wordpress docker image with OTel and Instana.

The OTel traces are sent to the Instana agent via gRPC/http to port 4317/4318.

## Prerequisites

A `docker-compose` installation running on your machine.

## Configure

Create a `.env` file copied from `.env.templatei` file and update below values.

```text
agent_key=<agent secret key>
download_key=<download secret key (optional agent key with download privileges)>
agent_zone=<name of the zone for the agent; default: envoy-tracing-demo>
agent_endpoint=<local ip or remote host ingress-red-saas.instana.io>
agent_endpoint_port=<443 already set as default; or 4443 for local>
```

## Build & Launch

```bash
docker-compose up --build -d
```

This will build and launch the following components:

- `wordpress` service, a simple wordpress application.
- `mariadb database` service, database for wordpress application.
- `instana agent` service, Instana agent listening on grpc/http endpoint.

## Running it

Then, go to `http://localhost:8080` to set up Wordpress site.

## Visualize traces

The resulting traces in the Analyze view will look like this in Instana UI:

Demo traces in the Analyze view
