const tls = require('tls');
const Transport = require('winston-transport');
const safeStringify = require('fast-safe-stringify');

const { hostname } = require('os');
const host = hostname();

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
      Object.assign(this.metadata, opts.metadata);
    }
  }

  async log(level, message) {
    setImmediate(() => {
      this.emit('logged', message);
    });

    const socket = tls
      .connect(config.port, config.host)
      .on('error', socketErrorHandler)
      .on('timeout', socketErrorHandler);

    await waitForConnection(socket);

    if (!socket.authorized) {
      throw 'Error connecting to DataDog';
    }

    // Merge the metadata with the log
    const logEntry = Object.assign({}, this.metadata, { level, message, source: 'dd-logs-transport', host });

    socket.write(`${config.apiKey} ${safeStringify(logEntry)}\r\n`, () => {
      socket.end();
    });
  }
};
