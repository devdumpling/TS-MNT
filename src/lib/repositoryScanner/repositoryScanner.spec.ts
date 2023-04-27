import { RepositoryScanner } from "./repositoryScanner";
import * as path from "path";

const PATH_TO_SAMPLE_REPO = path.resolve(__dirname, "../../../TestRepo");

describe("RepositoryScanner", () => {
  const tsConfigFile = path.resolve(PATH_TO_SAMPLE_REPO, "tsconfig.json");
  const repositoryScanner = new RepositoryScanner(tsConfigFile);

  test("should find components in a TypeScript repository", async () => {
    const rootDir = path.resolve(PATH_TO_SAMPLE_REPO, ".");
    const components = await repositoryScanner.scanRepository(rootDir);

    expect(components.length).toBeGreaterThan(0);
    expect(components).toContainEqual(
      expect.objectContaining({
        name: "SampleComponent",
        filePath: expect.stringContaining("TestRepo/src/SampleComponent.ts"),
      })
    );
  });
});
