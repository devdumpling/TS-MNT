#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { RepositoryScanner } from "./lib";
import path from "path";
import fs from "fs";
import type { ScannerOptions } from "./lib/types";

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
        })
        .option("filePatterns", {
          alias: "f",
          type: "array",
          description: "File patterns to include in the scan",
          demandOption: false,
        })
        .option("ignorePatterns", {
          alias: "i",
          type: "array",
          description: "File patterns to exclude from the scan",
          demandOption: false,
        })
        .option("internalPackages", {
          alias: "p",
          type: "array",
          description: "Internal package names to include in the scan",
          demandOption: false,
        })
        .option("internalPackagePrefix", {
          alias: "x",
          type: "string",
          description: "Prefix for internal package names",
          demandOption: false,
        })
        .option("possibleExtensions", {
          alias: "e",
          type: "array",
          description:
            "Possible file extensions to consider in the scan (only affects internal dependency detection)",
          demandOption: false,
        });
    },
    async (argv) => {
      // TODO -- sanitize and validate these inputs
      const tsConfigFile = path.resolve(argv.tsconfig);
      const rootDir = path.resolve(argv.root);
      const outputFile = argv?.output;

      const options: ScannerOptions = {
        filePatterns: argv.filePatterns as string[] | undefined,
        ignorePatterns: argv.ignorePatterns as string[] | undefined,
        internalPackages: argv.internalPackages as string[] | undefined,
        possibleExtensions: argv.possibleExtensions as string[] | undefined,
        internalPackagePrefix: argv.internalPackagePrefix as string | undefined,
      };

      if (options) {
        console.info("Options: ", options);
      }

      if (!fs.existsSync(tsConfigFile)) {
        console.error("tsconfig.json file not found.");
        process.exit(1);
      }

      if (!fs.existsSync(rootDir)) {
        console.error("Root directory not found.");
        process.exit(1);
      }

      const repositoryScanner = new RepositoryScanner(tsConfigFile, options);
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
        console.info("Order", components.order);
        console.info("Edges:", components.size);
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
