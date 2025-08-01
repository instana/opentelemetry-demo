# Instana PHP Otel Tracing demo app

This repository demonstrates Instana's tracing functionality
based on [OpenTelemetry](https://opentelemetry.io/docs/languages/php/).

This example is enahcned version of [OpenTelemetry Wordpress Instrumentation](https://github.com/open-telemetry/opentelemetry-php-contrib/tree/main/examples/instrumentation/Wordpress) example which auto instruments the official Wordpress docker image with OpenTelemetry.

The OTel traces are sent to the Instana agent OpenTelemetry plugin via gRPC/http to port 4317 or 4318.

## Prerequisites

A `docker-compose` installation running on your machine.

## Configure

Create a `.env` file in the root of the checked-out version of this repository and enter the following content.
The values need to be adjusted to your environment.

```text
agent_key=<agent secret key>
download_key=<download secret key (optional agent key with download privileges)>
agent_zone=<name of the zone for the agent; default: envoy-tracing-demo>
agent_endpoint=<local ip or remote host ingress-red-saas.instana.io>
agent_endpoint_port=<443 already set as default; or 4443 for local>
```

In most scenarios only the field `agent_key` and `agent_endpoint` are required.

A template [.env.template](.env.template) can be copied to `.env` for your convenience.

## Build & Launch

```bash
docker-compose up --build -d
```

This will build and launch the following components:
- `wordpress` service, a simple wordpress application 
- `mariadb database` service, database for wordpress application 
- `instana agent` service, Instana agent listening on grpc/http endpoint for otel traces.

## Running it
Then, go to http://localhost to set up Wordpress.

If you want to use the REST API, make sure that the following settings are applied at http://localhost/wp-admin:

Under Plugins > Installed Plugins, activate JSON Basic Authentication.
Under Settings > Permalinks, something other than Plain is selected.


## Visualize traces

After the agent is bootstrapped and starts accepting spans from PHP, the resulting traces in the Analyze view will
look like this:

![Demo traces in the Analyze view](images/trace-view.png)
