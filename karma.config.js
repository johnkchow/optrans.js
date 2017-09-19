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
    frameworks: ['mocha', 'chai'],
    files: files,
    reporters: ['progress', 'notify'],
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
  });
};
