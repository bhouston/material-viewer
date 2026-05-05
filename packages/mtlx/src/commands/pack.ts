import { packMaterialX } from '@material-viewer/mtlx-core';
import { defineCommand } from 'yargs-file-commands';

export const command = defineCommand({
  command: 'pack <input>',
  describe: 'Pack a root .mtlx file and its resources into a .mtlz archive',
  builder: (yargs) =>
    yargs
      .positional('input', {
        describe: 'Path to root .mtlx file',
        type: 'string',
        demandOption: true,
      })
      .option('output', {
        alias: 'o',
        describe: 'Output .mtlz path',
        type: 'string',
      }),
  handler: async (argv) => {
    try {
      const result = await packMaterialX(argv.input, { outputPath: argv.output });
      console.log(`Packed ${result.outputPath}`);
      console.log(`Root ${result.rootPath}`);
      console.log(`Entries ${result.entries.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ERROR ${message}`);
      process.exitCode = 1;
    }
  },
});
