import { RepositoryScanner } from "./repositoryScanner";
import * as path from "path";

describe("RepositoryScanner", () => {
  const tsConfigFile = path.resolve(
    __dirname,
    "../../../__mocks/__/TestRepo/tsconfig.json"
  );
  const repositoryScanner = new RepositoryScanner(tsConfigFile);

  const rootDir = path.resolve(__dirname, "../../../__mocks__/TestRepo");

  test("should find components in a TypeScript repository", async () => {
    const moduleGraph = await repositoryScanner.scanRepository(rootDir);
    console.log(moduleGraph);

    expect(moduleGraph.order).toBeGreaterThan(0);
  });

  // test("should find class utilities in a TypeScript repository", async () => {
  //   // cached after first run
  //   const moduleGraph = await repositoryScanner.scanRepository(rootDir);
  //   expect(moduleGraph.hasNode("SampleClass")).toBeTruthy();
  // });

  // test("should find class component in a TypeScript repository", async () => {
  //   // cached after first run
  //   const moduleGraph = await repositoryScanner.scanRepository(rootDir);
  //   expect(moduleGraph.hasNode("SampleClassComponent")).toBeTruthy();
  // });
});
