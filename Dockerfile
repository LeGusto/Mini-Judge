FROM node:18-alpine

# Cache bust: 2025-01-16
# Install compilers and system tools for code execution
RUN apk update && apk add --no-cache \
    build-base \
    gcc \
    g++ \
    python3 \
    python3-dev \
    bash \
    coreutils \
    file \
    && ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src/ ./src/
COPY problems/ ./problems/
RUN mkdir -p tmp/

# Verify compilers are installed
RUN gcc --version && g++ --version && python3 --version && time echo "time command works"

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/problems', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "src/server.js"]
