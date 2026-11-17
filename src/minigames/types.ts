export interface MinigameParams {
  /** 0-based rank: higher ranks play harder versions. */
  rank: number;
  title: string;
  /** The job's main and second skill levels; higher makes it easier. */
  main: number;
  second: number;
  /** Override the length in seconds (testing). */
  seconds?: number;
}

export interface MinigameResult {
  /** Score as a fraction of the rank's target, 0–1+. */
  percent: number;
  lines: string[];
}
