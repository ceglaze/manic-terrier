(function (global) {
  'use strict';

  const MT = (global.ManicTerrier = global.ManicTerrier || {});
  const P = MT.PALETTE;

  // Color character map for pixel art matrices
  const COLOR_MAP = {
    '.': null,
    'K': '#08080C', // Near-black outline/detail (visible on dark tiles)
    'B': P.BLUE,    // HTAFC Royal Blue
    'D': P.DARK_BLUE,
    'W': P.WHITE,
    'C': P.CYAN,
    'Y': P.YELLOW,
    'M': P.MAGENTA,
    'R': P.RED,
    'E': P.GREEN,
    'G': P.GOLD,
    'T': P.TAN,
    'S': P.GRAY,
  };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function compileSprite(rows, flipX, flipY, overrides) {
    const h = rows.length;
    const w = rows[0].length;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const ch = row[x];
        const col = (overrides && overrides[ch] !== undefined) ? overrides[ch] : COLOR_MAP[ch];
        if (!col) continue;
        const dx = flipX ? (w - 1 - x) : x;
        const dy = flipY ? (h - 1 - y) : y;
        ctx.fillStyle = col;
        ctx.fillRect(dx, dy, 1, 1);
      }
    }
    return c;
  }

  function buildDirectionalSet(frames) {
    // Returns { right: [...], left: [...], rightInv: [...], leftInv: [...] }
    return {
      right: frames.map((f) => compileSprite(f, false, false)),
      left: frames.map((f) => compileSprite(f, true, false)),
      rightInv: frames.map((f) => compileSprite(f, false, true)),
      leftInv: frames.map((f) => compileSprite(f, true, true)),
    };
  }

  // =========================================================================
  // TERRY THE TERRIER (16x16) — HTAFC Blue & White Striped Kit!
  // =========================================================================
  const TERRY_IDLE = [
    '....GG..GG......',
    '....GTG.GTG.....',
    '...GTTTTTTTG....',
    '...TTKTTTKTWW...',
    '...TTTTTTTTWWK..',
    '....TTTTWWWW....',
    '..T..WWWWWW.....',
    '.TT.BWBWBWBW....',
    '..T.BWBWBWBWW...',
    '....BWBWBWBW....',
    '....BWBWBWBW....',
    '....WWWWWWWW....',
    '....WWW..WWW....',
    '....BBB..BBB....',
    '...YKKK..YKKK...',
    '...KKKK..KKKK...',
  ];

  const TERRY_WALK1 = [
    '....GG..GG......',
    '....GTG.GTG.....',
    '...GTTTTTTTG....',
    '...TTKTTTKTWW...',
    '...TTTTTTTTWWK..',
    '....TTTTWWWW....',
    '.TT..WWWWWW.....',
    '..T.BWBWBWBWW...',
    '....BWBWBWBW....',
    '....BWBWBWBW....',
    '....WWWWWWWW....',
    '...WWW....WWW...',
    '..BBB......BBB..',
    '..YKK......YKK..',
    '..KKK......KKK..',
    '................',
  ];

  const TERRY_WALK2 = [
    '....GG..GG......',
    '....GTG.GTG.....',
    '...GTTTTTTTG....',
    '...TTKTTTKTWW...',
    '...TTTTTTTTWWK..',
    '....TTTTWWWW....',
    '..T..WWWWWW.....',
    '.TT.BWBWBWBW....',
    '....BWBWBWBWW...',
    '....BWBWBWBW....',
    '....WWWWWWWW....',
    '.....WW..WW.....',
    '.....BB..BB.....',
    '....YKK..YKK....',
    '....KKK..KKK....',
    '................',
  ];

  const TERRY_JUMP = [
    '...GG....GG.....',
    '...GTG..GTG.....',
    '...GTTTTTTTG....',
    '...TTKTTTKTWW...',
    '...TTTTTTTTWWK..',
    '....TTTTWWWW....',
    '.T..WWWWWWWW....',
    'TT.WBWBWBWBWW...',
    '...WBWBWBWBW....',
    '....BWBWBWBW....',
    '....WWWWWWWW....',
    '...WWW...WWW....',
    '..BBB.....BBB...',
    '.YKKK.....YKKK..',
    '................',
    '................',
  ];

  // Mini Terry icon for Lives HUD (10x10)
  const TERRY_ICON = [
    '..G..G....',
    '.GTTTTG...',
    '.TKTTKWW..',
    '..TTTWWK..',
    '.BWBWBW...',
    '.BWBWBW...',
    '.WWWWWW...',
    '.BB..BB...',
    'YKK..YKK..',
    '..........',
  ];

  // =========================================================================
  // STRICT REFEREE (16x16) — Black/White kit waving a bright RED CARD!
  // =========================================================================
  const REF_1 = [
    '...........RRRR.',
    '...........RRRR.',
    '....KKKK...RRRR.',
    '...KTTTTK..RRRR.',
    '...TKTTKT...TT..',
    '....TTTT...KW...',
    '...KWWWWK.KW....',
    '..KWKWKWKKW.....',
    '..KWKWKWKW......',
    '...WKWKWK.......',
    '...KKKKKK.......',
    '...KK..KK.......',
    '..WW....WW......',
    '..KK....KK......',
    '.KKK....KKK.....',
    '................',
  ];

  const REF_2 = [
    '..........RRRR..',
    '..........RRRR..',
    '....KKKK..RRRR..',
    '...KTTTTK.RRRR..',
    '...TKTTKT..TT...',
    '....TTTT..KW....',
    '...KWWWWKKW.....',
    '..KWKWKWKW......',
    '...WKWKWK.......',
    '...WKWKWK.......',
    '...KKKKKK.......',
    '....KK.KK.......',
    '....WW.WW.......',
    '...KK...KK......',
    '...KK...KK......',
    '................',
  ];

  // =========================================================================
  // VICTORIAN REFEREE (16x16) — Top hat, moustache & RED CARD (Level 2)
  // =========================================================================
  const VREF_1 = [
    '....KKKK...RRRR.',
    '....KKKK...RRRR.',
    '....WWWW...RRRR.',
    '..KKKKKKKK.RRRR.',
    '...KTTTTK...TT..',
    '...TKTTKT..KW...',
    '...WWWWWW.KW....',
    '..KWKWKWKKW.....',
    '..KWKWKWKW......',
    '...WKWKWK.......',
    '...KKKKKK.......',
    '...KK..KK.......',
    '..SS....SS......',
    '..KK....KK......',
    '.KKK....KKK.....',
    '................',
  ];

  const VREF_2 = [
    '....KKKK..RRRR..',
    '....KKKK..RRRR..',
    '....WWWW..RRRR..',
    '..KKKKKKKKRRRR..',
    '...KTTTTK..TT...',
    '...TKTTKT.KW....',
    '...WWWWWWKW.....',
    '..KWKWKWKW......',
    '...WKWKWK.......',
    '...WKWKWK.......',
    '...KKKKKK.......',
    '....KK.KK.......',
    '....SS.SS.......',
    '...KK...KK......',
    '...KK...KK......',
    '................',
  ];

  // =========================================================================
  // FLYING MEAT PIE (16x12) — Yorkshire matchday pie with 8-bit wings!
  // =========================================================================
  const PIE_1 = [
    '.WW....W.....WW.',
    'WCCW....W...WCCW',
    '.WCCW......WCCW.',
    '..WCYYYYYYYYCW..',
    '..WGYGYGYGYGYW..',
    '...GRRRRRRRRG...',
    '...GGGGGGGGGG...',
    '...GYYYYYYYYG...',
    '....GGGGGGGG....',
    '.....GGGGGG.....',
    '................',
    '................',
  ];

  const PIE_2 = [
    '.......W........',
    '........W.......',
    '....YYYYYYYY....',
    '...GYGYGYGYGY...',
    '..WGRRRRRRRRGW..',
    '.WCCGGGGGGGGCCW.',
    'WCCWGYYYYYYGWCCW',
    '.WW..GGGGGG..WW.',
    '.....GGGGGG.....',
    '................',
    '................',
    '................',
  ];

  // =========================================================================
  // COLLECTIBLES (10x10)
  // =========================================================================
  const FOOTBALL_1 = [
    '...YYYY...',
    '.YYWWWWYY.',
    '.YWWKKWWY.',
    'YWWKKKKWWY',
    'YWKKWWKKWY',
    'YWKKWWKKWY',
    'YWWKKKKWWY',
    '.YWWKKWWY.',
    '.YYWWWWYY.',
    '...YYYY...',
  ];

  const FOOTBALL_2 = [
    '...WWWW...',
    '.WWYYYYWW.',
    '.WYKKKKYW.',
    'WYKKYYKKYW',
    'WYYKKKKYYW',
    'WYYKKKKYYW',
    'WYKKYYKKYW',
    '.WYKKKKYW.',
    '.WWYYYYWW.',
    '...WWWW...',
  ];

  const STAR_1 = [
    '....CC....',
    '....CC....',
    '...CWWC...',
    'CCCWWWWCCC',
    '.CCWWWWCC.',
    '..CWWWWC..',
    '..CCWWCC..',
    '.CC....CC.',
    'CC......CC',
    '..........',
  ];

  const STAR_2 = [
    '....YY....',
    '....YY....',
    '...YWWY...',
    'YYYWWWWYYY',
    '.YYWWWWYY.',
    '..YWWWWY..',
    '..YYWWYY..',
    '.YY....YY.',
    'YY......YY',
    '..........',
  ];

  const TROPHY_1 = [
    '.YYYYYYYY.',
    'MYYYYYYYYM',
    'MYWWYYWWYM',
    'MYYYYYYYYM',
    '.MYYYYYYM.',
    '..YYYYYY..',
    '...YYYY...',
    '...YWWY...',
    '..YYYYYY..',
    '.MMMMMMMM.',
  ];

  const TROPHY_2 = [
    '.WWWWWWWW.',
    'YWWWWWWWWY',
    'YWYYYYYYWY',
    'YWWYYYYWWY',
    '.YWWWWWWY.',
    '..YYYYYY..',
    '...WWWW...',
    '...YYYY...',
    '..WWWWWW..',
    '.CCCCCCCC.',
  ];

  // =========================================================================
  // ROGUE CORNER FLAG (8x8) — Upright and Inverted
  // =========================================================================
  const FLAG_1 = [
    '..WBBBB.',
    '..WBWWB.',
    '..WWBBW.',
    '..WMMMM.',
    '..W.....',
    '..W.....',
    '.YWY....',
    'YYYYY...',
  ];

  const FLAG_2 = [
    '..W.BBBB',
    '..WBBWWB',
    '..WWBWW.',
    '..WMMMM.',
    '..W.....',
    '..W.....',
    '.YWY....',
    'YYYYY...',
  ];

  // =========================================================================
  // BUILD SPRITE CACHE
  // =========================================================================
  MT.sprites = {
    terry: {
      idle: buildDirectionalSet([TERRY_IDLE]),
      walk: buildDirectionalSet([TERRY_WALK1, TERRY_IDLE, TERRY_WALK2, TERRY_IDLE]),
      jump: buildDirectionalSet([TERRY_JUMP]),
      icon: compileSprite(TERRY_ICON, false, false),
    },
    referee: buildDirectionalSet([REF_1, REF_2]),
    vreferee: buildDirectionalSet([VREF_1, VREF_2]),
    pie: [compileSprite(PIE_1, false, false), compileSprite(PIE_2, false, false)],
    items: {
      football: [compileSprite(FOOTBALL_1, false, false), compileSprite(FOOTBALL_2, false, false)],
      star: [compileSprite(STAR_1, false, false), compileSprite(STAR_2, false, false)],
      trophy: [compileSprite(TROPHY_1, false, false), compileSprite(TROPHY_2, false, false)],
    },
    flagUp: [compileSprite(FLAG_1, false, false), compileSprite(FLAG_2, false, false)],
    flagDown: [compileSprite(FLAG_1, false, true), compileSprite(FLAG_2, false, true)],
  };

  // =========================================================================
  // TILE RENDERER (Crisp 8x8 ZX Spectrum tiles, themed per cavern)
  // =========================================================================
  MT.drawTile = function (ctx, tileType, px, py, theme, animTick, crumbleLevel, gDir, switchFlipped) {
    const T = MT.TILES;
    switch (tileType) {
      case T.SOLID:
      case T.WALL: {
        if (theme === 'cowshed') {
          ctx.fillStyle = tileType === T.WALL ? P.DARK_BLUE : P.BLUE;
          ctx.fillRect(px, py, 8, 8);
          ctx.fillStyle = tileType === T.WALL ? P.BLUE : P.WHITE;
          ctx.fillRect(px, py, 8, 1);
          ctx.fillStyle = P.BLACK;
          ctx.fillRect(px, py + 4, 8, 1);
          ctx.fillRect(px + 3, py + 1, 1, 3);
          ctx.fillRect(px + 7, py + 5, 1, 3);
          if (tileType === T.SOLID) {
            ctx.fillStyle = P.CYAN;
            ctx.fillRect(px + 1, py + 2, 1, 1);
            ctx.fillRect(px + 5, py + 6, 1, 1);
          }
        } else if (theme === 'castle') {
          ctx.fillStyle = tileType === T.WALL ? '#182444' : '#2E4575';
          ctx.fillRect(px, py, 8, 8);
          ctx.fillStyle = P.CYAN;
          ctx.fillRect(px, py, 8, 1);
          ctx.fillStyle = P.WHITE;
          ctx.fillRect(px + 1, py + 1, 2, 1);
          ctx.fillStyle = P.BLACK;
          ctx.fillRect(px, py + 4, 8, 1);
          ctx.fillRect(px + 4, py + 1, 1, 3);
          ctx.fillRect(px + 1, py + 5, 1, 3);
          ctx.fillStyle = P.BLUE;
          ctx.fillRect(px + 5, py + 6, 2, 1);
        } else {
          // Chapman's Trophy Vault — regal blue, gold & magenta accents
          ctx.fillStyle = tileType === T.WALL ? P.DARK_BLUE : P.BLUE;
          ctx.fillRect(px, py, 8, 8);
          ctx.fillStyle = P.YELLOW;
          ctx.fillRect(px, py, 8, 1);
          ctx.fillRect(px, py + 7, 8, 1);
          ctx.fillStyle = P.MAGENTA;
          ctx.fillRect(px + 3, py + 3, 2, 2);
          ctx.fillStyle = P.BLACK;
          ctx.fillRect(px, py + 2, 1, 4);
          ctx.fillRect(px + 7, py + 2, 1, 4);
        }
        break;
      }

      case T.CRUMBLE: {
        // crumbleLevel: 0 = intact (8px tall), 7 = 1px left, >= 8 = gone
        const eroded = Math.min(8, Math.max(0, crumbleLevel || 0));
        const rem = 8 - eroded;
        if (rem <= 0) return;
        // Erode from top when normal gravity, or from bottom when inverted
        const startY = gDir < 0 ? py : py + eroded;
        for (let r = 0; r < rem; r++) {
          const ry = startY + r;
          ctx.fillStyle = (r % 2 === 0) ? P.WHITE : P.CYAN;
          if (eroded >= 4 && r === 0) ctx.fillStyle = P.YELLOW;
          ctx.fillRect(px, ry, 8, 1);
          ctx.fillStyle = P.BLUE;
          ctx.fillRect(px + ((r + eroded) % 4) * 2, ry, 1, 1);
        }
        break;
      }

      case T.CONVEYOR_L:
      case T.CONVEYOR_R: {
        const dir = tileType === T.CONVEYOR_R ? 1 : -1;
        const shift = ((Math.floor(animTick * 14) * dir) % 8 + 8) % 8;
        ctx.fillStyle = P.DARK_BLUE;
        ctx.fillRect(px, py, 8, 8);
        ctx.fillStyle = P.CYAN;
        ctx.fillRect(px, py, 8, 1);
        ctx.fillRect(px, py + 7, 8, 1);
        // Animated scrolling treads
        ctx.fillStyle = P.YELLOW;
        for (let i = 0; i < 8; i += 4) {
          const sx = (i + shift) % 8;
          ctx.fillRect(px + sx, py + 2, 2, 1);
          ctx.fillRect(px + ((sx + dir + 8) % 8), py + 3, 2, 2);
          ctx.fillRect(px + sx, py + 5, 2, 1);
        }
        break;
      }

      case T.FLAG_UP: {
        const frame = Math.floor(animTick * 6) % 2;
        ctx.drawImage(MT.sprites.flagUp[frame], px, py);
        break;
      }

      case T.FLAG_DOWN: {
        const frame = Math.floor(animTick * 6) % 2;
        ctx.drawImage(MT.sprites.flagDown[frame], px, py);
        break;
      }

      case T.GRAV_PAD: {
        const pulse = Math.floor(animTick * 8) % 2;
        ctx.fillStyle = P.DARK_BLUE;
        ctx.fillRect(px, py, 8, 8);
        ctx.fillStyle = pulse ? P.MAGENTA : P.CYAN;
        ctx.fillRect(px, py, 8, 2);
        ctx.fillRect(px, py + 6, 8, 2);
        ctx.fillStyle = P.WHITE;
        // Double arrows showing gravity inversion
        ctx.fillRect(px + 3, py + 2, 2, 1);
        ctx.fillRect(px + 2, py + 3, 4, 2);
        ctx.fillRect(px + 3, py + 5, 2, 1);
        break;
      }

      case T.SWITCH: {
        const pulse = Math.floor(animTick * 6) % 2;
        const flipV = gDir === 'ceiling';
        if (flipV) {
          // Ceiling-mounted Gravity-Flip Switch
          ctx.fillStyle = P.BLUE;
          ctx.fillRect(px + 1, py, 6, 3);
          ctx.fillStyle = pulse ? P.MAGENTA : P.YELLOW;
          ctx.fillRect(px + 2, py + 1, 4, 1);
          ctx.fillStyle = P.WHITE;
          if (switchFlipped) {
            ctx.fillRect(px + 4, py + 3, 1, 2);
            ctx.fillRect(px + 5, py + 5, 2, 2);
            ctx.fillStyle = P.MAGENTA;
            ctx.fillRect(px + 5, py + 6, 2, 2);
          } else {
            ctx.fillRect(px + 3, py + 3, 1, 2);
            ctx.fillRect(px + 1, py + 5, 2, 2);
            ctx.fillStyle = P.CYAN;
            ctx.fillRect(px + 1, py + 6, 2, 2);
          }
        } else {
          // Floor-mounted Gravity-Flip Switch
          ctx.fillStyle = P.BLUE;
          ctx.fillRect(px + 1, py + 5, 6, 3);
          ctx.fillStyle = pulse ? P.MAGENTA : P.YELLOW;
          ctx.fillRect(px + 2, py + 6, 4, 1);
          ctx.fillStyle = P.WHITE;
          if (switchFlipped) {
            ctx.fillRect(px + 4, py + 3, 1, 2);
            ctx.fillRect(px + 5, py + 1, 2, 2);
            ctx.fillStyle = P.MAGENTA;
            ctx.fillRect(px + 5, py, 2, 2);
          } else {
            ctx.fillRect(px + 3, py + 3, 1, 2);
            ctx.fillRect(px + 1, py + 1, 2, 2);
            ctx.fillStyle = P.CYAN;
            ctx.fillRect(px + 1, py, 2, 2);
          }
        }
        break;
      }

      case T.FLOOD_LAMP: {
        ctx.fillStyle = P.GRAY;
        ctx.fillRect(px, py, 8, 4);
        ctx.fillStyle = P.BLUE;
        ctx.fillRect(px + 1, py + 4, 6, 2);
        ctx.fillStyle = (Math.floor(animTick * 10) % 2) ? P.WHITE : P.CYAN;
        ctx.fillRect(px + 1, py + 6, 6, 2);
        break;
      }
    }
  };

  // =========================================================================
  // TUNNEL TO THE PITCH EXIT DOOR (16x16)
  // =========================================================================
  MT.drawTunnel = function (ctx, x, y, unlocked, animTick) {
    const flash = Math.floor(animTick * 12) % 4;
    const archColors = [P.BLUE, P.WHITE, P.CYAN, P.YELLOW];
    const outerCol = unlocked ? archColors[flash] : P.DARK_BLUE;
    const innerCol = unlocked ? archColors[(flash + 2) % 4] : P.GRAY;

    // Outer stadium tunnel frame
    ctx.fillStyle = outerCol;
    ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = P.BLACK;
    ctx.fillRect(x + 2, y + 2, 12, 14);

    if (unlocked) {
      // Glowing stadium pitch beckoning inside!
      ctx.fillStyle = (flash % 2 === 0) ? P.GREEN : P.CYAN;
      ctx.fillRect(x + 3, y + 8, 10, 8);
      // White pitch lines
      ctx.fillStyle = P.WHITE;
      ctx.fillRect(x + 3, y + 11, 10, 1);
      ctx.fillRect(x + 7, y + 8, 2, 8);
      // Stadium sky / floodlight glow
      ctx.fillStyle = (flash % 2 === 0) ? P.BLUE : P.MAGENTA;
      ctx.fillRect(x + 3, y + 3, 10, 5);
      // Flashing arch bulbs
      ctx.fillStyle = innerCol;
      ctx.fillRect(x + 1, y + 1, 2, 2);
      ctx.fillRect(x + 13, y + 1, 2, 2);
      ctx.fillRect(x + 7, y, 2, 2);
    } else {
      // Locked shutter bars
      ctx.fillStyle = '#182036';
      ctx.fillRect(x + 3, y + 3, 10, 13);
      ctx.fillStyle = P.GRAY;
      for (let bx = 4; bx <= 10; bx += 3) {
        ctx.fillRect(x + bx, y + 3, 1, 13);
      }
      ctx.fillStyle = P.RED;
      ctx.fillRect(x + 6, y + 8, 4, 3);
    }
  };
})(window);
