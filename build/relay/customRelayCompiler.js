require('babel-polyfill');
const crypto = require('crypto');
const {
  ConsoleReporter,
  Runner: CodegenRunner,
  FileIRParser: RelayJSModuleParser,
  FileWriter: RelayFileWriter,
  IRTransforms: RelayIRTransforms,
  formatGeneratedModule,
} = require('relay-compiler');

const fs = require('fs');
const path = require('path');

const {
  buildASTSchema,
  buildClientSchema,
  parse,
  printSchema,
} = require('graphql');

const {
  codegenTransforms,
  fragmentTransforms,
  printTransforms,
  queryTransforms,
  schemaExtensions,
} = RelayIRTransforms;

function getFilepathsFromGlob(baseDir, options) {
  const {extensions, include, exclude} = options;
  const patterns = include.map(inc => `${inc}/*.+(${extensions.join('|')})`);

  const glob = require('fast-glob');
  return glob.sync(patterns, {
    cwd: baseDir,
    bashNative: [],
    onlyFiles: true,
    ignore: exclude,
  });
}

// Ripped from RelayFileWriter.js
// function md5(x: string): string {
function md5(x) {
  return crypto
    .createHash('md5')
    .update(x, 'utf8')
    .digest('hex');
}

// takes operation.text as string param
// returns Promise<string>
function persistQuery(operationText) {
  return new Promise((resolve) => {
    const queryId = md5(operationText);

    // TODO: store queryId to query in map

    console.log(`mapped ${operationText} to ${queryId}`);
    resolve(queryId);
  });
}

function getRelayFileWriter(baseDir) {
  return (onlyValidate, schema, documents, baseDocuments) =>
    new RelayFileWriter({
      config: {
        baseDir,
        compilerTransforms: {
          codegenTransforms,
          fragmentTransforms,
          printTransforms,
          queryTransforms,
        },
        customScalars: {},
        formatModule: formatGeneratedModule,
        inputFieldWhiteListForFlow: [],
        schemaExtensions,
        useHaste: false,
        persistQuery,
      },
      onlyValidate,
      schema,
      baseDocuments,
      documents,
    });
}

function getSchema(schemaPath) {
  try {
    let source = fs.readFileSync(schemaPath, 'utf8');
    if (path.extname(schemaPath) === '.json') {
      source = printSchema(buildClientSchema(JSON.parse(source).data));
    }
    source = `
  directive @include(if: Boolean) on FRAGMENT | FIELD
  directive @skip(if: Boolean) on FRAGMENT | FIELD

  ${source}
  `;
    return buildASTSchema(parse(source));
  } catch (error) {
    throw new Error(
      'Error loading schema. Expected the schema to be a .graphql or a .json'
    );
  }
}

async function run() {
  const srcDir = path.resolve(__dirname, '../../src');
  const schemaPath = path.resolve(__dirname, '../graphql/compiled/schema.graphql');
  console.log(`srcDir: ${srcDir}, schemaPath: ${schemaPath}`);
  const reporter = new ConsoleReporter({verbose: true});
  const parserConfigs = {
    default: {
      baseDir: srcDir,
      getFileFilter: RelayJSModuleParser.getFileFilter,
      getParser: RelayJSModuleParser.getParser,
      getSchema: () => getSchema(schemaPath),
      filepaths: getFilepathsFromGlob(srcDir, {
        extensions: ['js'],
        include: ['**'],
        exclude: [
          '**/node_modules/**',
          '**/__mocks__/**',
          '**/__tests__/**',
          '**/__generated__/**',
        ]
      }),
    },
  };
  const writerConfigs = {
    default: {
      getWriter: getRelayFileWriter(srcDir),
      isGeneratedFile: (filePath) =>
        filePath.endsWith('.js') && filePath.includes('__generated__'),
      parser: 'default',
    },
  };
  const codegenRunner = new CodegenRunner({
    reporter,
    parserConfigs,
    writerConfigs,
    onlyValidate: false,
  });

  const result = await codegenRunner.compileAll();

  // write query id map a file so the server can pick it up


  console.log(`Done! result: ${result}`);
}

(async function () {
  console.log(`Starting relay graphql compilation`);
  try {
    await run();
  } catch (err) {
    console.log(`error: ${err}`);
  }
})();