require('babel-register')({
  babelrc: false,
  presets: [
    'env',
    'stage-0',
  ],
});

require('./bootstrap');
