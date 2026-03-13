FROM node:24.14.0

# https://github.com/Yelp/dumb-init
ADD --chmod=755 https://github.com/Yelp/dumb-init/releases/download/v1.2.5/dumb-init_1.2.5_x86_64 /usr/bin/dumb-init

# Leverage Docker's cache system.
# package.json will be changed less often than other files, so copy it first
# and install all dependencies.
USER node
WORKDIR /app
COPY --chown=node:node package*.json /app
RUN npm ci --omit=dev

ENV LISTEN=0.0.0.0

COPY --chown=node:node . /app
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
