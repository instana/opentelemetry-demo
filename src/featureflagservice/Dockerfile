    # Copyright The OpenTelemetry Authors
# SPDX-License-Identifier: Apache-2.0


# Find eligible builder and runner images on Docker Hub. We use Ubuntu/Debian instead of
# Alpine to avoid DNS resolution issues in production.
#
# https://hub.docker.com/r/hexpm/elixir/tags?page=1&name=ubuntu
# https://hub.docker.com/_/ubuntu?tab=tags
#
#
# This file is based on these images:
#
#   - https://hub.docker.com/r/hexpm/elixir/tags - for the build image
#   - https://hub.docker.com/_/debian?tab=tags&page=1&name=bullseye-20210902-slim - for the release image
#   - https://pkgs.org/ - resource for finding needed packages
#   - Ex: hexpm/elixir:1.14.3-erlang-25.2.3-debian-buster-20230202-slim
# DO NOT CHANGE ELIXIR OR OTP OR DEBIAN VERSION OR IT WILL BREAK GHA BUILD
# Once there are ARM runners for GHA we can upgrade this.
# Not until then.
ARG ELIXIR_VERSION=1.14.3
ARG OTP_VERSION=23.3.4.14
ARG DEBIAN_VERSION=buster-20210902-slim

ARG BUILDER_IMAGE="hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="debian:${DEBIAN_VERSION}"

FROM ${BUILDER_IMAGE} as builder

# install build dependencies
RUN apt-get update -y && apt-get install -y build-essential git wget \
    && apt-get clean && rm -f /var/lib/apt/lists/*_*

# prepare build dir
WORKDIR /app

# install hex + rebar
RUN mix local.hex --force --verbose
RUN mix local.rebar --force --verbose
RUN wget https://github.com/erlang/rebar3/releases/download/3.20.0/rebar3 && chmod +x rebar3 && mv rebar3 ~/.mix
RUN wget https://github.com/rebar/rebar/wiki/rebar && chmod +x rebar && mv rebar ~/.mix
RUN mix archive.install github hexpm/hex branch latest --force

# set build ENV
ENV MIX_ENV="prod"

# install mix dependencies
COPY ./src/featureflagservice/mix.exs ./src/featureflagservice/mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mkdir config

# copy compile-time config files before we compile dependencies
# to ensure any relevant config change will trigger the dependencies
# to be re-compiled.
COPY ./src/featureflagservice/config/config.exs ./src/featureflagservice/config/${MIX_ENV}.exs config/

# patch opentelemetry_ecto to enable Instana downstream correlation
RUN  sed -i 's/base_attributes = \%{/&\n      "db.system": "postgres",\n      "net.peer.port": "5432",\n      "net.peer.name": repo.config()[:hostname],/' ./deps/opentelemetry_ecto/lib/opentelemetry_ecto.ex

RUN mix deps.compile

COPY ./src/featureflagservice/priv priv

COPY ./src/featureflagservice/lib lib

COPY ./src/featureflagservice/src src

COPY ./src/featureflagservice/assets assets

COPY ./pb/demo.proto proto/

COPY ./src/featureflagservice/rebar.config ./src/featureflagservice/rebar.lock ./

# generate protobuf files with rebar
RUN ~/.mix/rebar3 grpc_regen

# compile assets
RUN mix assets.deploy

# Compile the release
RUN mix compile

# Changes to config/runtime.exs don't require recompiling the code
COPY ./src/featureflagservice/config/runtime.exs config/

COPY ./src/featureflagservice/rel rel
RUN mix release

# start a new build stage so that the final image will only contain
# the compiled release and other runtime necessities
FROM ${RUNNER_IMAGE}

RUN apt-get update -y && apt-get install -y openssl libncurses5 locales curl \
  && apt-get clean && rm -f /var/lib/apt/lists/*_*

# Set the locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen

ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

WORKDIR "/app"
RUN chown nobody /app

# set runner ENV
ENV MIX_ENV="prod"
ENV SECRET_KEY_BASE="mNhoOKKxgyvBIwbtw0P23waQcvUOmusb2U1moG2I7JQ3Bt6+MlGb5ZTrHwqbqy7j"

# Only copy the final release from the build stage
COPY --from=builder --chown=nobody:root /app/_build/${MIX_ENV}/rel/featureflagservice ./

USER nobody

ENTRYPOINT ["/app/bin/server"]
