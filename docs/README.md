# TS-MNT

Typescript Modularity Nuance Tool (TS-MNT)

## Introduction

The TypeScript Modularity Measurement Tool (TS-MNT) aims to analyze TypeScript repositories, particularly those with React components, to identify issues related to modularity, cohesion, and coupling. This document serves as a Request for Comments (RFC) for the design of TS-MNT.

## USAGE

### CLI

#### `scan`

Flags:

- `-t` or `--tsconfig` - path to tsconfig.json
- `-r` or `--repo` - path to repository
- `-o` or `--output` - path to output JSON file
- `-f` or `--filePatterns` - file patterns to include in scan (default: `['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']`)
- `-i` or `--ignorePatterns` - file patterns to ignore in scan (default: `['**/node_modules/**', '**/dist/**']`)
- `-p` or `--internalPackages` - pacakges considered internal e.g. `@myorg/package` (default: `[]`)
- `-x` or `--internalPackagePrefix` - prefix for internal packages e.g. `@myorg` (default: `undefined`)
- `-e` or `--possibleExtensions` - file extensions to consider in the scan (only affects internal dependency detection)
- `-d` or `--debug` - enable debug mode (default: `false`)

Outputs:

- `ts-mnt-report.json` - report of modularity analysis

Example:

`p cli scan -t path_to_tsconfig -r path_to_repo -o path_to_output/name_of_output_file.json`

## Roadmap

Overall:

- [ ] Polish tests
- [ ] Update documentation explanation and provide high level overview video
- [ ] Publish to npm

`RepositoryScanner`:

- [x] MVP
- [ ] ignore patterns for nodes you don't want in the graph

`CohesionAnalyzer`:

- [x] MVP
- [ ] Analyze average scores of directories
- [ ] Provide standard deviation of scores
- [ ] Detect outliers
- [ ] Allow for weight overrides

`CouplingAnalyzer`:

- [ ] MVP

`DependencyVisualizer`:

- [ ] MVP

`ModularityReporter`:

- [ ] MVP

`CLI`:

- [x] MVP
- [ ] Add CohesionAnalyzer to CLI

## Bugs/Gotchas

HIGH PRIORITY

- `ignorePatterns` is not factored in when adding the internal dependencies for a FileNode. These should be excluded from the graph by design.

LOW PRIORITY

- If a function component returns _only_ an empty fragment (e.g. <></>) it will be classified as a utility. This is because the empty fragment isn't actually classified as JSX Element. Not sure this is relevant for most use-cases, but something to be aware of.
- Components with the same name overrite each other in the graph (should probably use a combination of name and path as the node key to avoid this)
- params from functions internal to a component are currently added to that component's props (which is not correct), but fixing it is tricky -- working through this right now
- debug/verbose pattern is a little ugly

## Goals

The primary goal of TS-MNT is to provide a comprehensive analysis of TypeScript repositories to:

1. Detect components with low cohesion
2. Identify components that are tightly coupled
3. Suggest improvements to increase modularity and maintainability
4. Automate dependency analysis and visualization
5. Encourage the adoption of best practices for modular design

## Design Overview

TS-MNT will be designed as a command-line tool and a library that can be integrated into build pipelines or Continuous Integration (CI) systems. The tool will have the following components:

1. **Repository Scanner**: Scans the repository to identify TypeScript files, React components, and their dependencies.
2. **Cohesion Analyzer**: Analyzes the code to detect low cohesion in components.
3. **Coupling Analyzer**: Identifies components that are tightly coupled to other components or the application itself.
4. **Dependency Visualizer**: Generates dependency graphs to visualize component dependencies.
5. **Modularity Reporter**: Provides a detailed report of the modularity analysis, including suggestions for improvement.

### Repository Scanner

The Repository Scanner component will:

- Traverse the file structure of the TypeScript repository
- Identify TypeScript files and React components
- Extract import statements and dependencies between components

The scanner will use the TypeScript Compiler API to parse and analyze TypeScript files, which allows for accurate extraction of dependencies and symbols.

### Cohesion Analyzer

The Cohesion Analyzer component will:

- Evaluate the responsibilities of each component based on function and class declarations
- Analyze the size of components in terms of lines of code and the number of methods or functions
- Identify components with low cohesion based on their responsibilities and size

### Coupling Analyzer

The Coupling Analyzer component will:

- Analyze the dependencies between components identified by the Repository Scanner
- Identify tight coupling by examining the use of props, context, direct calls to other components' methods, or shared global state
- Provide a list of components with high coupling and the reasons behind the coupling

### Dependency Visualizer

The Dependency Visualizer component will:

- Generate a visual representation of component dependencies using tools like `madge`, `dependency-cruiser`, or `pnpm-why`
- Highlight components with high coupling or circular dependencies
- Provide an interactive visualization for easy exploration and analysis

### Modularity Reporter

The Modularity Reporter component will:

- Consolidate the results of the Cohesion Analyzer, Coupling Analyzer, and Dependency Visualizer
- Generate a detailed report containing the analysis, low cohesion components, high coupling components, and dependency visualization
- Provide suggestions for refactoring and improving modularity

## Implementation

TS-MNT will be implemented using TypeScript and Node.js. It will use the TypeScript Compiler API for code analysis and parsing, and it will leverage existing libraries like `madge` or `dependency-cruiser` for dependency visualization.

The tool will be designed to be extensible, allowing for additional analyzers or visualizers to be easily integrated in the future.

## Conclusion

The TypeScript Modularity Measurement Tool (TS-MNT) will provide valuable insights into the modularity of TypeScript repositories, helping developers identify and address issues related to low cohesion and high coupling. By following the design outlined in this RFC, we can create a powerful tool to improve the maintainability and readability of TypeScript codebases.
