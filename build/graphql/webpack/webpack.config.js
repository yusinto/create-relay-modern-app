import path from 'path';

const compiler = 'buildSchema.js';

export default {
  entry: ['babel-polyfill', `./build/graphql/${compiler}`],
  target: 'node',
  node: {
    __dirname: false,
  },
  output: {
    path: path.resolve('./build/graphql'),
    filename: `${compiler}.transpiled`,
    pathinfo: true,
  },
};
