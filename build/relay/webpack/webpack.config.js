import path from 'path';
import nodeExternals from 'webpack-node-externals';
const compiler = 'customRelayCompiler.js';

export default {
  entry: ['babel-polyfill', `./build/relay/${compiler}`],
  target: 'node',
  node: {
    __dirname: false,
  },
  externals: [nodeExternals()], // ignore all modules in node_modules folder
  output: {
    path: path.resolve('./build/relay'),
    filename: `${compiler}.transpiled`,
    pathinfo: true,
  },
};
