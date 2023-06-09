import Graph from "graphology";

interface Weights {
  lineCount: number;
  componentUtilityCount: number;
  dependencyCount: number;
}

const DEFAULT_WEIGHTS: Weights = {
  lineCount: 0.1,
  componentUtilityCount: 1,
  dependencyCount: 0.5,
};

export class CohesionAnalyzer {
  private readonly moduleGraph: Graph;
  private cohesionScores: Map<string, number[]>;

  constructor(moduleGraph: Graph) {
    this.moduleGraph = moduleGraph;

    // Map of FileNode path to cohesion score tuple
    // Tuple is [raw, normalized_by_median]
    // Raw scores are more useful for comparing across repositories
    // Normalized scores are more useful for comparing within a repository
    this.cohesionScores = new Map<string, number[]>();
  }

  analyze(): Map<string, number[]> {
    const fileNodes = this.moduleGraph.filterNodes(
      (_node, attr) => attr.type === "file"
    );

    // Calculate median or average values
    const lineCounts = fileNodes.map((fileNode) =>
      this.moduleGraph.getNodeAttribute(fileNode, "lineCount")
    );

    const componentUtilityCounts = fileNodes.map((fileNode) => {
      const neighbors = this.moduleGraph.neighbors(fileNode);
      return neighbors.filter(
        (neighbor) =>
          this.moduleGraph.getNodeAttribute(neighbor, "type") === "component" ||
          this.moduleGraph.getNodeAttribute(neighbor, "type") === "utility"
      ).length;
    });

    const dependencyCounts = fileNodes.map((fileNode) =>
      this.moduleGraph.outDegree(fileNode)
    );

    const medianLineCount = this.median(lineCounts);
    const medianComponentUtilityCount = this.median(componentUtilityCounts);
    const medianDependencyCount = this.median(dependencyCounts);

    // Calculate cohesion score for each file node
    for (const fileNode of fileNodes) {
      const lineCount = this.moduleGraph.getNodeAttribute(
        fileNode,
        "lineCount"
      );
      const neighbors = this.moduleGraph.neighbors(fileNode);
      const componentUtilityCount = neighbors.filter(
        (neighbor) =>
          this.moduleGraph.getNodeAttribute(neighbor, "type") === "component" ||
          this.moduleGraph.getNodeAttribute(neighbor, "type") === "utility"
      ).length;
      // const dependencyCount = this.moduleGraph.outDegree(fileNode);
      const dependencyCount = this.moduleGraph.getNodeAttribute(
        fileNode,
        "dependencies"
      ).length;

      const cohesionMatrix = [
        lineCount,
        componentUtilityCount,
        dependencyCount,
      ];

      const normalizedCohesionMatrix = [
        this.normalize(lineCount, medianLineCount),
        this.normalize(componentUtilityCount, medianComponentUtilityCount),
        this.normalize(dependencyCount, medianDependencyCount),
      ];

      const rawScore = this.calcCohesionScore(
        this.weightCohesionMatrix(cohesionMatrix)
      );

      const normalizedScore = this.calcCohesionScore(
        this.weightCohesionMatrix(normalizedCohesionMatrix)
      );

      this.cohesionScores.set(fileNode, [rawScore, normalizedScore]);
    }

    return this.getCohesionScores();
  }

  getCohesionScores(): Map<string, number[]> {
    return this.cohesionScores;
  }

  getNormalizedCohesionScores(): Map<string, number> {
    const normalizedScores = new Map<string, number>();
    for (const [fileNode, scores] of this.cohesionScores) {
      normalizedScores.set(fileNode, scores[1]);
    }
    return normalizedScores;
  }

  getRawCohesionScores(): Map<string, number> {
    const rawScores = new Map<string, number>();
    for (const [fileNode, scores] of this.cohesionScores) {
      rawScores.set(fileNode, scores[0]);
    }
    return rawScores;
  }

  // Average across a provided score map
  getAverageScore(scores: Map<string, number>): number {
    return (
      Array.from(scores.values()).reduce((acc, curr) => {
        if (!curr || isNaN(curr) || !isFinite(curr)) {
          return acc;
        } else {
          return acc + curr;
        }
      }, 0) / scores.size
    );
  }

  getMedianScore(scores: Map<string, number>): number {
    const sortedScores = Array.from(scores.values()).sort((a, b) => a - b);
    return sortedScores[Math.ceil(sortedScores.length / 2) - 1];
  }

  // Grabs scores below a given percentile, e.g. look at the bottom 25% (0.25) of scores
  getScoresBelowPercentile(scores: Map<string, number>, percentile: number) {
    if (percentile < 0 || percentile > 1) {
      throw new Error("Percentile must be between 0 and 1");
    }

    if (percentile === 0 || scores.size === 0) {
      return new Map<string, number>();
    }

    const sortedScores = Array.from(scores.values()).sort((a, b) => a - b);
    const cutoff =
      sortedScores[Math.ceil(sortedScores.length * percentile) - 1];
    const belowCutoff = new Map<string, number>();
    for (const [fileNode, score] of scores) {
      if (score < cutoff) {
        belowCutoff.set(fileNode, score);
      }
    }
    return belowCutoff;
  }

  getLeastCohesive(scores: Map<string, number>): Map<string, number> {
    const minScore = Math.min(
      ...Array.from(scores.values()).filter(
        (x) => (x !== null || !isNaN(x)) && isFinite(x)
      )
    );
    const minScores = new Map<string, number>();
    for (const [fileNode, score] of scores) {
      if (score === minScore) {
        minScores.set(fileNode, score);
      }
    }
    return minScores;
  }

  getMostCohesive(scores: Map<string, number>): Map<string, number> {
    const validScores = Array.from(scores.values()).filter(
      (x) => (x !== null || !isNaN(x)) && isFinite(x)
    );
    const maxScore = Math.max(...validScores);
    const maxScores = new Map<string, number>();
    for (const [fileNode, score] of scores) {
      if (score === maxScore) {
        maxScores.set(fileNode, score);
      }
    }
    return maxScores;
  }

  // Normalizing should get all of our values close to 1
  // A value > 1 means the value is larger than the median
  // A value < 1 means the value is smaller than the median
  private normalize(value: number, median: number): number {
    // Check for division by zero
    if (median === 0) return 0;
    return value / median;
  }

  private weightCohesionMatrix(
    matrix: number[],
    weights: Weights = DEFAULT_WEIGHTS
  ): number[] {
    const weightedMatrix = matrix.map((value, index) => {
      return value * Object.values(weights)[index];
    });

    return weightedMatrix;
  }

  // Higher score = more cohesive
  // Note we prefer a weighted sum here instead of a weighted product
  // to make it easier to interpret and control when tuning the weights.
  // This approach is also less sensitive to outliers in the input data.
  private calcCohesionScore(matrix: number[]): number {
    return 1 / matrix.reduce((acc, curr) => acc + curr, 0);
  }

  private median(numbers: number[]): number {
    const sortedNumbers = numbers.slice().sort((a, b) => a - b);
    const middleIndex = Math.floor(sortedNumbers.length / 2);

    if (sortedNumbers.length % 2 === 0) {
      return (sortedNumbers[middleIndex - 1] + sortedNumbers[middleIndex]) / 2;
    } else {
      return sortedNumbers[middleIndex];
    }
  }

  pruneOutliers(scores: Map<string, number>): Map<string, number> {
    const prunedScores = new Map<string, number>();
    const outliers = this.detectOutliers(scores);
    for (const [fileNode, score] of scores) {
      if (!outliers.has(fileNode)) {
        prunedScores.set(fileNode, score);
      }
    }
    return prunedScores;
  }

  // outlier detection method using the interquartile range (IQR)
  detectOutliers(scores: Map<string, number>): Map<string, number> {
    const q1Scores = this.getScoresBelowPercentile(scores, 0.25);
    const q3Scores = this.getScoresBelowPercentile(scores, 0.75);

    const q1 =
      q1Scores.size > 0 ? Math.max(...Array.from(q1Scores.values())) : 0;
    const q3 =
      q3Scores.size > 0 ? Math.max(...Array.from(q3Scores.values())) : 0;

    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers = new Map<string, number>();
    for (const [fileNode, score] of scores) {
      if (score < lowerBound || score > upperBound) {
        outliers.set(fileNode, score);
      }
    }
    return outliers;
  }
}
