import path from 'path';
import nodeExternals from 'webpack-node-externals';

const compiler = 'buildSchema.js';

export default {
  entry: ['babel-polyfill', `./build/graphql/${compiler}`],
  target: 'node',
  node: {
    __dirname: false,
  },
  externals: [nodeExternals()], // ignore all modules in node_modules folder
  output: {
    path: path.resolve('./build/graphql'),
    filename: `${compiler}.transpiled`,
    pathinfo: true,
  },
};
