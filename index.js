const tls = require('tls');
const Transport = require('winston-transport');
const safeStringify = require('fast-safe-stringify');

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

  async log(info) {
    setImmediate(() => {
      this.emit('logged', info);
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
    const logEntry = Object.assign({}, this.metadata, info);

    socket.write(`${config.apiKey} ${safeStringify(logEntry)}\r\n`, () => {
      socket.end();
    });
  }
};
