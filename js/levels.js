(function (global) {
  'use strict';

  const MT = (global.ManicTerrier = global.ManicTerrier || {});
  const T = MT.TILES;

  const CHAR_TO_TILE = {
    '.': T.EMPTY,
    '#': T.WALL,
    '=': T.SOLID,
    '~': T.CRUMBLE,
    '<': T.CONVEYOR_L,
    '>': T.CONVEYOR_R,
    '^': T.FLAG_UP,
    'v': T.FLAG_DOWN,
    'G': T.GRAV_PAD,
    'S': T.SWITCH,
    'L': T.FLOOD_LAMP,
  };

  function parseMap(lines) {
    const grid = [];
    for (let r = 0; r < MT.ROWS; r++) {
      const line = lines[r] || '';
      const row = [];
      for (let c = 0; c < MT.COLS; c++) {
        const ch = line[c] || '.';
        row.push(CHAR_TO_TILE[ch] !== undefined ? CHAR_TO_TILE[ch] : T.EMPTY);
      }
      grid.push(row);
    }
    return grid;
  }

  MT.LEVELS = [
    // =========================================================================
    // CAVERN 1: THE COWSHED CAVERN
    // Classic conveyor-belt platforming, crumbling terrace tiles, flying meat
    // pies, patrolling strict referees, and a central Zero-G floodlight beam.
    // =========================================================================
    {
      id: 1,
      name: 'THE COWSHED CAVERN',
      subtitle: 'ZERO-G FLOODLIGHT & CONVEYORS',
      theme: 'cowshed',
      spawn: { col: 3, row: 15, facing: 1, gDir: 1 },
      tunnel: { col: 28, row: 4 },
      map: parseMap([
        '###########LLLLLLLLLL###########', // 00
        '#..............................#', // 01
        '#..............................#', // 02
        '#..............................#', // 03
        '#..............................#', // 04
        '#..............................#', // 05
        '#===========........===========#', // 06
        '#..............................#', // 07
        '#..............................#', // 08
        '#..............................#', // 09
        '#..............................#', // 10
        '#===>>>>>>===......==~~~<<<<<==#', // 11
        '#..............................#', // 12
        '#..............................#', // 13
        '#..............................#', // 14
        '#..............................#', // 15
        '#.........^........^...........#', // 16
        '################################', // 17
      ]),
      zones: [
        { type: 'zerog', col: 11, row: 1, w: 10, h: 16 },
      ],
      items: [
        { type: 'football', col: 2, row: 9, points: 250 },
        { type: 'football', col: 29, row: 15, points: 250 },
        { type: 'star', col: 29, row: 9, points: 350 },
        { type: 'trophy', col: 15.4, row: 7, points: 500 },
        { type: 'star', col: 2, row: 4, points: 350 },
      ],
      enemies: [
        { type: 'referee', x: 23 * 8, y: 15 * 8, minX: 21 * 8, maxX: 28.5 * 8, speed: 30, dir: 1, gDir: 1 },
        { type: 'referee', x: 5 * 8, y: 4 * 8, minX: 4 * 8, maxX: 10 * 8, speed: 28, dir: 1, gDir: 1 },
        { type: 'pie', x: 14 * 8, y: 13 * 8, minX: 11 * 8, maxX: 19 * 8, speed: 34, dir: 1, bobAmp: 4, bobFreq: 3.0 },
        { type: 'pie', x: 4 * 8, y: 8 * 8, minX: 2 * 8, maxX: 10 * 8, speed: 30, dir: -1, bobAmp: 3, bobFreq: 2.8 },
      ],
    },

    // =========================================================================
    // CAVERN 2: CASTLE HILL'S WINDY SUMMIT
    // High-altitude Yorkshire stone ledges, upward antigravity wind updrafts,
    // crumbling battlements, flying pies & patrolling Victorian referees.
    // =========================================================================
    {
      id: 2,
      name: "CASTLE HILL'S WINDY SUMMIT",
      subtitle: 'WIND UPDRAFTS & VICTORIAN REFS',
      theme: 'castle',
      spawn: { col: 2, row: 15, facing: 1, gDir: 1 },
      tunnel: { col: 15, row: 3 },
      map: parseMap([
        '################################', // 00
        '#..............................#', // 01
        '#..............................#', // 02
        '#..............................#', // 03
        '#..............................#', // 04
        '#=====....~~========~~....=====#', // 05
        '#..............................#', // 06
        '#..............................#', // 07
        '#..............................#', // 08
        '#..............................#', // 09
        '#..........................^...#', // 10
        '#==~~=....>>>======~~~....=====#', // 11
        '#..............................#', // 12
        '#..............................#', // 13
        '#..............................#', // 14
        '#..............................#', // 15
        '#..........................^...#', // 16
        '################################', // 17
      ]),
      zones: [
        { type: 'updraft', col: 6, row: 1, w: 4, h: 16 },
        { type: 'updraft', col: 22, row: 1, w: 4, h: 16 },
        { type: 'zerog', col: 13, row: 1, w: 6, h: 4 },
      ],
      items: [
        { type: 'star', col: 2, row: 9, points: 350 },
        { type: 'football', col: 29, row: 15, points: 250 },
        { type: 'football', col: 29, row: 9, points: 250 },
        { type: 'trophy', col: 15.4, row: 9, points: 500 },
        { type: 'star', col: 2, row: 3, points: 350 },
        { type: 'trophy', col: 28, row: 3, points: 500 },
      ],
      enemies: [
        { type: 'vreferee', x: 13 * 8, y: 15 * 8, minX: 11 * 8, maxX: 20 * 8, speed: 32, dir: 1, gDir: 1 },
        { type: 'vreferee', x: 12 * 8, y: 9 * 8, minX: 11 * 8, maxX: 19.5 * 8, speed: 30, dir: -1, gDir: 1 },
        { type: 'pie', x: 6 * 8, y: 8 * 8, minX: 4 * 8, maxX: 10.5 * 8, speed: 29, dir: 1, bobAmp: 4, bobFreq: 3.2 },
        { type: 'pie', x: 23 * 8, y: 7 * 8, minX: 20.5 * 8, maxX: 27 * 8, speed: 31, dir: -1, bobAmp: 4, bobFreq: 3.0 },
      ],
    },

    // =========================================================================
    // CAVERN 3: CHAPMAN'S TROPHY VAULT
    // Interactive Gravity-Flip Switches & Pads invert gravity so Terry runs
    // upside-down along ceilings to claim the 1926 Thrice Champions Trophies!
    // =========================================================================
    {
      id: 3,
      name: "CHAPMAN'S TROPHY VAULT",
      subtitle: 'GRAVITY-FLIP SWITCHES & CEILING RUN',
      theme: 'vault',
      spawn: { col: 2, row: 15, facing: 1, gDir: 1 },
      tunnel: { col: 28, row: 4 },
      map: parseMap([
        '############LLLLLLLL############', // 00
        '#....v..S.............v.S......#', // 01
        '#..............................#', // 02
        '#..............................#', // 03
        '#..............................#', // 04
        '#..............................#', // 05
        '#G===========......============#', // 06
        '#..............................#', // 07
        '#..............................#', // 08
        '#..............................#', // 09
        '#..............................#', // 10
        '#...====~~~===....==>>>>>>=G...#', // 11
        '#..............................#', // 12
        '#..............................#', // 13
        '#..............................#', // 14
        '#..............................#', // 15
        '#..........S...................#', // 16
        '############################G###', // 17
      ]),
      zones: [
        { type: 'zerog', col: 12, row: 1, w: 8, h: 16 },
      ],
      items: [
        { type: 'football', col: 21, row: 15, points: 250 },
        { type: 'trophy', col: 5, row: 12, points: 500 },
        { type: 'star', col: 2, row: 1, points: 350 },
        { type: 'trophy', col: 15.4, row: 1, points: 500 },
        { type: 'trophy', col: 4, row: 4, points: 500 },
        { type: 'star', col: 24, row: 9, points: 350 },
      ],
      enemies: [
        { type: 'referee', x: 17 * 8, y: 15 * 8, minX: 14 * 8, maxX: 25 * 8, speed: 34, dir: 1, gDir: 1 },
        // Upside-down Strict Referee patrolling the vaulted ceiling!
        { type: 'referee', x: 13 * 8, y: 1 * 8, minX: 10 * 8, maxX: 19.5 * 8, speed: 30, dir: -1, gDir: -1 },
        { type: 'pie', x: 20 * 8, y: 8 * 8, minX: 17 * 8, maxX: 28 * 8, speed: 36, dir: 1, bobAmp: 4, bobFreq: 3.4 },
      ],
    },
  ];
})(window);
