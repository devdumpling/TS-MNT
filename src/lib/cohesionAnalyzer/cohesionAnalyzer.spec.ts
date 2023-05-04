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
});
