/** Board size defaults used across test suites */
export const DEFAULT_BOARD_SIZE = 10;
export const DEFAULT_WIN_CONDITION = 5;
export const SMALL_BOARD_SIZE = 5;
export const SMALL_WIN_CONDITION = 3;

/** Player symbols matching CaroGame internals */
export enum Player {
  X = 'X',
  O = 'O',
}

/** CSS / DOM selectors for UI elements */
export const SELECTORS = {
  title: '.header h1',
  statusBar: '#statusBar',
  board: '#board',
  cell: '.cell',
  labelsTop: '#labelsTop',
  labelsLeft: '#labelsLeft',

  /* Buttons */
  btnStart: '#btnStart',
  btnPause: '#btnPause',
  btnReset: '#btnReset',
  btnSettings: '#btnSettings',
  btnSettingsSave: '#btnSettingsSave',
  btnSettingsCancel: '#btnSettingsCancel',

  /* Settings overlay & inputs */
  settingsOverlay: '#settingsOverlay',
  settingBoardSize: '#settingBoardSize',
  settingWinCondition: '#settingWinCondition',
  boardSizeLabel: '#boardSizeLabel',
  winCondLabel: '#winCondLabel',

  /* Score display */
  scoreX: '#scoreX',
  scoreO: '#scoreO',
  scoreDraw: '#scoreDraw',

  /* Speed slider */
  speedSlider: '#speedSlider',
  speedLabel: '#speedLabel',
} as const;

/**
 * Score values returned by CaroGame._scoreLine.
 * Keys describe the tactical pattern.
 */
export const SCORE_THRESHOLDS = {
  instantWin: 1_000_000,
  fourOpenTwoEnds: 50_000,
  fourOpenOneEnd: 8_000,
  threeOpenTwoEnds: 3_000,
  threeOpenOneEnd: 500,
  twoOpenTwoEnds_longWin: 400,
  twoOpenOneEnd_longWin: 50,
  oneOpenTwoEnds: 30,
  oneOpenOneEnd: 5,
  blocked: 0,
} as const;
