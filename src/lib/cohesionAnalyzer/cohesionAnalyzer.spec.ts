import { RepositoryScanner } from "../repositoryScanner/repositoryScanner";
import { CohesionAnalyzer } from "./cohesionAnalyzer";
import * as path from "path";

describe("CohesionAnalyzer", () => {
  const tsConfigFile = path.resolve(
    __dirname,
    "../../../__mocks__/TestRepo/tsconfig.json"
  );
  const repositoryScanner = new RepositoryScanner(tsConfigFile);

  const rootDir = path.resolve(__dirname, "../../../__mocks__/TestRepo");

  test("should analyze cohesion in a TypeScript repository", async () => {
    // Scan the repository and obtain the module graph
    const moduleGraph = await repositoryScanner.scanRepository(rootDir);

    const cohesionAnalyzer = new CohesionAnalyzer(moduleGraph);

    // Analyze cohesion using the module graph
    const cohesionScores = cohesionAnalyzer.analyze();

    console.log(cohesionScores);

    // Add expectations here, e.g., expect specific scores or other results
    expect(cohesionScores.size).toBeGreaterThan(0);
  });

  test("should calculate the average score of cohesion scores", async () => {
    const moduleGraph = await repositoryScanner.scanRepository(rootDir);
    const cohesionAnalyzer = new CohesionAnalyzer(moduleGraph);
    const cohesionScores = cohesionAnalyzer.analyze();
    const rawScores = cohesionAnalyzer.getRawCohesionScores();

    const averageRawScore = cohesionAnalyzer.getAverageScore(rawScores);

    console.log("Average raw cohesion score:", averageRawScore);

    expect(averageRawScore).toBeGreaterThanOrEqual(0);
    expect(averageRawScore).toBeLessThanOrEqual(1);
  });

  test("should return scores below a given percentile", async () => {
    const moduleGraph = await repositoryScanner.scanRepository(rootDir);
    const cohesionAnalyzer = new CohesionAnalyzer(moduleGraph);
    const cohesionScores = cohesionAnalyzer.analyze();
    const rawScores = cohesionAnalyzer.getRawCohesionScores();

    console.log(rawScores);

    const percentile = 0.25;
    const scoresBelowPercentile = cohesionAnalyzer.getScoresBelowPercentile(
      rawScores,
      percentile
    );

    console.log("Scores below the 25th percentile:", scoresBelowPercentile);

    const minValue = Math.min(...rawScores.values());
    const maxValue = Math.max(...rawScores.values());
    const cutoff = minValue + (maxValue - minValue) * percentile;

    for (const score of scoresBelowPercentile.values()) {
      expect(score).toBeLessThan(cutoff);
    }
  });
});
