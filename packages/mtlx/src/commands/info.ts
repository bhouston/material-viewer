import { readMaterialX } from '@material-viewer/mtlx-core';
import { defineCommand } from 'yargs-file-commands';

export const command = defineCommand({
  command: 'info <input>',
  describe: 'Print information about a MaterialX file',
  builder: (yargs) =>
    yargs.positional('input', {
      describe: 'Path to .mtlx file',
      type: 'string',
      demandOption: true,
    }),
  handler: async (argv) => {
    const document = await readMaterialX(argv.input);
    const payload = {
      attributes: document.attributes,
      topLevelNodes: document.nodes.length,
      nodeGraphs: document.nodeGraphs.length,
      nodeCategories: [...new Set(document.nodes.map((node) => node.category))].toSorted(),
    };
    console.log(JSON.stringify(payload, null, 2));
  },
});
