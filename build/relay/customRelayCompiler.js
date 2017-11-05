import 'babel-polyfill';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import RelayCompiler from 'relay-compiler';
import {
  buildASTSchema,
  buildClientSchema,
  parse,
  printSchema,
} from 'graphql';
import type {GraphQLSchema} from 'graphql';

const {
  ConsoleReporter,
  Runner: CodegenRunner,
  FileIRParser: RelayJSModuleParser,
  FileWriter: RelayFileWriter,
  IRTransforms: RelayIRTransforms,
  formatGeneratedModule,
} = RelayCompiler;
const {
  codegenTransforms,
  fragmentTransforms,
  printTransforms,
  queryTransforms,
  schemaExtensions,
} = RelayIRTransforms;

function md5(x: string): string {
  return crypto
    .createHash('md5')
    .update(x, 'utf8')
    .digest('hex');
}

function persistQuery(operationText: string): Promise<string> {
  return new Promise((resolve) => {
    const queryId = md5(operationText);

    // TODO: store queryId to query in map
    console.log(`mapped ${operationText} to ${queryId}`);
    resolve(queryId);
  });
}

function getFilepathsFromGlob(
  baseDir,
  options: {
    extensions: Array<string>,
    include: Array<string>,
    exclude: Array<string>,
  },
): Array<string> {
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

function getRelayFileWriter(baseDir: string) {
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

function getSchema(schemaPath: string): GraphQLSchema {
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
      `
Error loading schema. Expected the schema to be a .graphql or a .json
file, describing your GraphQL server's API. Error detail:

${error.stack}
    `.trim(),
    );
  }
}

async function run(src: string, schema: string) {
  const srcDir = path.resolve(process.cwd(), src);
  const schemaPath = path.resolve(process.cwd(), schema);
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

  // TODO: write query id map a file so the server can pick it up
  console.log(`Done! ${result}`);
}

(async function () {
  console.log(`Starting relay compilation`);
  try {
    await run('src', 'build/graphql/compiled/schema.graphql');
  } catch (err) {
    console.log(`error: ${err}`);
  }
})();