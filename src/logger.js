// @flow

const LOG_LEVEL_MAPPINGS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  logLevel: number;

  constructor(logLevelstr: $Keys<typeof LOG_LEVEL_MAPPINGS>) {
    this.logLevel = LOG_LEVEL_MAPPINGS[logLevelstr];
  }

  debug(msg: string) {
    if (console && console.debug && this.logLevel <= LOG_LEVEL_MAPPINGS.debug) {
      console.debug(msg);
    }
  }

  info(msg: string) {
    if (console && console.info && this.logLevel <= LOG_LEVEL_MAPPINGS.info) {
      console.info(msg);
    }
  }

  warn(msg: string) {
    if (console && console.warn && this.logLevel <= LOG_LEVEL_MAPPINGS.warn) {
      console.warn(msg);
    }
  }

  error(msg: string) {
    if (console && console.error && this.logLevel <= LOG_LEVEL_MAPPINGS.error) {
      console.error(msg);
    }
  }
}

// $FlowFixMe
export default new Logger(process.env.LOG_LEVEL || 'info')
