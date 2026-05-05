import { checkMaterialXPackage } from '@material-viewer/mtlx-core';
import { defineCommand } from 'yargs-file-commands';

export const runCheck = async (input: string): Promise<boolean> => {
  const result = await checkMaterialXPackage(input);

  if (result.issues.length === 0) {
    console.log(`Check passed: ${result.path}`);
    return true;
  }

  for (const issue of result.issues) {
    const line = `${issue.level.toUpperCase()} ${issue.location}: ${issue.message}`;
    if (issue.level === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  return !result.issues.some((issue) => issue.level === 'error');
};

export const command = defineCommand({
  command: 'check <input>',
  describe: 'Validate a .mtlx file or .mtlz package',
  builder: (yargs) =>
    yargs.positional('input', {
      describe: 'Path to .mtlx or .mtlz file',
      type: 'string',
      demandOption: true,
    }),
  handler: async (argv) => {
    const ok = await runCheck(argv.input);
    if (!ok) {
      process.exitCode = 1;
    }
  },
});
