#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { RepositoryScanner } from "./lib";
import path from "path";
import fs from "fs";

yargs(hideBin(process.argv))
  .command(
    "scan",
    "Scan a TypeScript repository",
    (yargs) => {
      return yargs
        .option("tsconfig", {
          alias: "t",
          type: "string",
          description: "Path to the tsconfig.json file",
          demandOption: true,
        })
        .option("root", {
          alias: "r",
          type: "string",
          description: "Path to the root directory of the repository",
          demandOption: true,
        })
        .option("output", {
          alias: "o",
          type: "string",
          description: "Path to the output file",
          demandOption: false,
        });
    },
    async (argv) => {
      const tsConfigFile = path.resolve(argv.tsconfig);
      const rootDir = path.resolve(argv.root);
      const outputFile = argv?.output;

      if (!fs.existsSync(tsConfigFile)) {
        console.error("tsconfig.json file not found.");
        process.exit(1);
      }

      if (!fs.existsSync(rootDir)) {
        console.error("Root directory not found.");
        process.exit(1);
      }

      const repositoryScanner = new RepositoryScanner(tsConfigFile);
      const components = await repositoryScanner.scanRepository(rootDir);

      if (outputFile) {
        fs.writeFileSync(
          outputFile,
          JSON.stringify(
            components,
            (_key, value) => (value instanceof Set ? [...value] : value),
            2
          )
        );
        console.log(`Components written to ${outputFile}`);
      } else {
        console.log("Found components:");
        console.log(
          JSON.stringify(
            components,
            (_key, value) => (value instanceof Set ? [...value] : value),
            2
          )
        );
      }
    }
  )
  .demandCommand(1, "You need to specify a command.")
  .strict()
  .parse();
