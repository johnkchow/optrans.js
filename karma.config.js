const webpackConfig = Object.assign(
  {},
  require('./webpack.config.js'),
  { devtool: 'inline-source-map' },
);

const files = [
  { pattern: 'test/**/*.js', watched: false },
];

module.exports = (config) => {
  config.set({
    logLevel: config.LOG_INFO,
    frameworks: ['mocha', 'chai'],
    files,
    reporters: ['progress'],
    port: 9876,
    colors: true,
    browsers: ['Chrome', 'ChromeHeadless'],
    autoWatch: false,
    // singleRun: false,
    concurrency: Infinity,
    preprocessors: {
      'test/**/*.js': ['webpack', 'sourcemap'],
    },
    autoWatchBatchDelay: 1000,
    webpack: webpackConfig,
    webpackMiddleware: {
      noInfo: true,
      stats: 'errors-only',
    },
    client: {
      mocha: {
        grep: config.grep,
      },
    },
  });
};
