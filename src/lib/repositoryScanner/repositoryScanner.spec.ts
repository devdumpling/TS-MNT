import { RepositoryScanner } from "./repositoryScanner";
import * as path from "path";

describe("RepositoryScanner", () => {
  const tsConfigFile = path.resolve(
    __dirname,
    "../../../__mocks/__/TestRepo/tsconfig.json"
  );
  const repositoryScanner = new RepositoryScanner(tsConfigFile);

  test("should find components in a TypeScript repository", async () => {
    const rootDir = path.resolve(__dirname, "../../../__mocks__/TestRepo");
    const components = await repositoryScanner.scanRepository(rootDir);

    console.log(components);

    expect(components.length).toBeGreaterThan(0);
    expect(components).toContainEqual(
      expect.objectContaining({
        name: "SampleClass",
        filePath: expect.stringContaining("TestRepo/src/SampleClass.ts"),
      })
    );
    expect(components).toContainEqual(
      expect.objectContaining({
        name: "SampleComponent",
        filePath: expect.stringContaining("TestRepo/src/SampleComponent.tsx"),
      })
    );
  });
});
