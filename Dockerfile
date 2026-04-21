FROM node:24-alpine

# https://github.com/Yelp/dumb-init
# ADD --chmod=755 https://github.com/Yelp/dumb-init/releases/download/v1.2.5/dumb-init_1.2.5_x86_64 /usr/bin/dumb-init
RUN apk add --no-cache dumb-init

USER node
WORKDIR /app

# node -e "require('https').get('https://example.com', v => console.log('OK', v.statusCode)).on('error', e => console.error(e))"
ENV LISTEN=0.0.0.0 \
    AUTHWALL_LOGGER=stdout \
    NODE_ENV=production \
    NODE_OPTIONS=--use-openssl-ca

# Leverage Docker's cache system.
# package.json will be changed less often than other files, so copy it first
# and install all dependencies.
COPY --chown=node:node package*.json .
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

ARG AUTHWALL_CREATED
ARG AUTHWALL_REVISION
ARG AUTHWALL_SOURCE="https://github.com/vbarbarosh/authwall"
ARG AUTHWALL_VERSION

LABEL org.opencontainers.image.title="vbarbarosh/authwall" \
      org.opencontainers.image.description="Minimal login gateway for protecting internal apps" \
      org.opencontainers.image.created="${AUTHWALL_CREATED}" \
      org.opencontainers.image.revision="${AUTHWALL_REVISION}" \
      org.opencontainers.image.source="${AUTHWALL_SOURCE}" \
      org.opencontainers.image.version="${AUTHWALL_VERSION}" \
      org.opencontainers.image.licenses="MIT"

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/index.js"]
