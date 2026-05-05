import { unpackMaterialZ } from '@material-viewer/mtlx-core';
import { defineCommand } from 'yargs-file-commands';

export const command = defineCommand({
  command: 'unpack <input>',
  describe: 'Unpack a .mtlz archive into a directory',
  builder: (yargs) =>
    yargs
      .positional('input', {
        describe: 'Path to .mtlz archive',
        type: 'string',
        demandOption: true,
      })
      .option('output-dir', {
        alias: 'd',
        describe: 'Output directory',
        type: 'string',
      })
      .option('force', {
        describe: 'Delete the output directory before extracting',
        type: 'boolean',
        default: false,
      }),
  handler: async (argv) => {
    try {
      const result = await unpackMaterialZ(argv.input, {
        outputDir: argv.outputDir,
        force: argv.force,
      });
      console.log(`Unpacked ${result.outputDir}`);
      console.log(`Root ${result.rootPath}`);
      console.log(`Entries ${result.entries.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ERROR ${message}`);
      process.exitCode = 1;
    }
  },
});
