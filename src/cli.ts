#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { RepositoryScanner, CohesionAnalyzer } from "./lib";
import { mapReplacer } from "./lib/helpers";
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
          description: "Path to the output directory",
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
        })
        .option("debug", {
          alias: "d",
          type: "boolean",
          description: "Enable debug logging",
          demandOption: false,
        });
    },
    async (argv) => {
      // TODO -- sanitize and validate these inputs
      const tsConfigFile = path.resolve(argv.tsconfig);
      const rootDir = path.resolve(argv.root);
      const outputDir = argv?.output;

      const options: ScannerOptions = {
        filePatterns: argv.filePatterns as string[] | undefined,
        ignorePatterns: argv.ignorePatterns as string[] | undefined,
        internalPackages: argv.internalPackages as string[] | undefined,
        possibleExtensions: argv.possibleExtensions as string[] | undefined,
        internalPackagePrefix: argv.internalPackagePrefix as string | undefined,
        debug: argv.debug as boolean | undefined,
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

      // Scan
      const repositoryScanner = new RepositoryScanner(tsConfigFile, options);
      const components = await repositoryScanner.scanRepository(rootDir);

      // Analyze
      const cohesionAnalyzer = new CohesionAnalyzer(components);
      const cohesionScores = cohesionAnalyzer.analyze();
      const rawScores = cohesionAnalyzer.getRawCohesionScores();
      const normalizedScores = cohesionAnalyzer.getNormalizedCohesionScores();
      const averageRawScore = cohesionAnalyzer.getAverageScore(rawScores);
      const averageNormalizedScore =
        cohesionAnalyzer.getAverageScore(normalizedScores);
      const medianRawScore = cohesionAnalyzer.getMedianScore(rawScores);
      const medianNormalizedScore =
        cohesionAnalyzer.getMedianScore(normalizedScores);
      const mostCohesive = cohesionAnalyzer.getMostCohesive(normalizedScores);
      const leastCohesive = cohesionAnalyzer.getLeastCohesive(normalizedScores);
      const below25thPercentile = cohesionAnalyzer.getScoresBelowPercentile(
        normalizedScores,
        0.25
      );

      if (outputDir) {
        fs.writeFileSync(
          `${outputDir}/scan.json`,
          JSON.stringify(
            components,
            (_key, value) => (value instanceof Set ? [...value] : value),
            2
          )
        );
        console.log(`Components written to ${outputDir}/scan.json`);
        console.info("Order", components.order);
        console.info("Edges:", components.size);
        fs.writeFileSync(
          `${outputDir}/raw-scores.json`,
          JSON.stringify(rawScores, mapReplacer, 2)
        );
        console.log(`Raw scores written to ${outputDir}/raw-scores.json`);
        fs.writeFileSync(
          `${outputDir}/normalized-scores.json`,
          JSON.stringify(normalizedScores, mapReplacer, 2)
        );
        console.log(
          `Normalized scores written to ${outputDir}/normalized-scores.json`
        );
        fs.writeFileSync(
          `${outputDir}/report.json`,
          JSON.stringify(
            {
              order: components.order,
              edges: components.size,
              averageRawScore,
              averageNormalizedScore,
              medianRawScore,
              medianNormalizedScore,
              mostCohesive,
              leastCohesive,
              below25thPercentile,
            },
            mapReplacer,
            2
          )
        );
      } else {
        console.log("Found components:");
        console.log(
          JSON.stringify(
            components,
            (_key, value) => (value instanceof Set ? [...value] : value),
            2
          )
        );
        console.info("Order", components.order);
        console.info("Edges:", components.size);
        console.info("Raw Scores:", rawScores);
        console.info("Normalized Scores:", normalizedScores);
        console.info("Average Score (raw):", averageRawScore);
        console.info("Average Score (normalized):", averageNormalizedScore);
        console.info("Median Score (raw):", medianRawScore);
        console.info("Median Score (normalized):", medianNormalizedScore);
        console.info("Most Cohesive (normalized):", mostCohesive);
        console.info("Least Cohesive (normalized):", leastCohesive);
        console.info(
          "Below 25th Percentile (normalized):",
          below25thPercentile
        );
      }
    }
  )
  .demandCommand(1, "You need to specify a command.")
  .strict()
  .parse();
