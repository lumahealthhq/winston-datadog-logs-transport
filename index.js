const tls = require('tls');
const Transport = require('winston-transport');
const safeStringify = require('fast-safe-stringify');
const { hostname } = require('os');
const host = hostname();

let ddtrace = require('dd-trace');

const config = {
  host: 'intake.logs.datadoghq.com',
  port: 10516
};

const waitForConnection = socket => new Promise(resolve => socket.on('secureConnect', resolve));
const socketErrorHandler = error => {
  // eslint-disable-next-line no-console
  console.log('datadog socket error', error);
};

// @see @credits https://git.io/fhwzM

module.exports = class DatadogTransport extends Transport {
  constructor(opts) {
    super(opts);

    this.metadata = {};
    config.apiKey = opts.apiKey;

    if (opts.metadata) {
      const { metadata } = opts;

      // tags in datadog
      if (metadata.tags && Object.keys(metadata.tags).length) {
        opts.metadata.ddtags = Object.keys(metadata.tags).map((curr) => `${curr}:${metadata.tags[curr]}`).join(',')
      }

      // source in datadog
      opts.metadata.ddsource = opts.metadata.source || undefined;
    }

    if (opts.metadata) {
      Object.assign(this.metadata, opts.metadata);
    }
  }

  async log(level, data, other) {
    setImmediate(() => {
      this.emit('logged', data || other['0']);
    });

    const socket = tls
      .connect(config.port, config.host)
      .on('error', socketErrorHandler)
      .on('timeout', socketErrorHandler);

    await waitForConnection(socket);

    if (!socket.authorized) {
      throw 'Error connecting to DataDog';
    }

    let metadata = this.metadata;
    let datadog;
    if (other.dd) {
      metadata.ddtags = `span_id:${other.dd.span_id},trace_id:${other.dd.trace_id}`;
      datadog = {
        span_id: other.dd.span_id,
        trace_id: other.dd.trace_id
      }
    }

    // Merge the metadata with the log
    const logEntry = Object.assign({}, metadata, { level, data, host, datadog });

    socket.write(`${config.apiKey} ${safeStringify(logEntry)}\r\n`, () => {
      socket.end();
    });
  }
};
