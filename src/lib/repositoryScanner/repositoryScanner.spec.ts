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

    expect(components.length).toBeGreaterThan(0);
    expect(components).toContainEqual(
      expect.objectContaining({
        name: "SampleClass",
        filePath: expect.stringContaining("TestRepo/src/SampleClass.ts"),
        type: "utility",
      })
    );
    expect(components).toContainEqual(
      expect.objectContaining({
        name: "SampleComponent",
        filePath: expect.stringContaining("TestRepo/src/SampleComponent.tsx"),
        type: "component",
      })
    );
    expect(components).toContainEqual(
      expect.objectContaining({
        name: "SampleComponent2",
        filePath: expect.stringContaining("TestRepo/src/SampleComponent.tsx"),
        type: "component",
      })
    );
    expect(components).toContainEqual(
      expect.objectContaining({
        name: "SampleComponent3",
        filePath: expect.stringContaining("TestRepo/src/SampleComponent.tsx"),
        type: "component",
      })
    );
    expect(components).toContainEqual(
      expect.objectContaining({
        name: "SampleComponent4",
        filePath: expect.stringContaining("TestRepo/src/SampleComponent.tsx"),
        type: "component",
      })
    );
  });
});
