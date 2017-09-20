const webpack = require('webpack');

module.exports = {
  entry: './lib/index.js',
  output: {
    path: __dirname,
    filename: 'bundle.js',
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL || 'debug'),
    }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: { cacheDirectory: true },
        },
      },
    ],
  },
};
