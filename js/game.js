(function (global) {
  'use strict';

  const MT = (global.ManicTerrier = global.ManicTerrier || {});
  const P = MT.PALETTE;
  const T = MT.TILES;
  const PHYS = MT.PHYS;

  const HIGH_SCORE_KEY = 'manic_terrier_htafc_highscore_v1';

  class ManicTerrierGame {
    constructor(canvas, bezelEl) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.bezelEl = bezelEl;

      // Persistent High Score
      this.highScore = this._loadHighScore();
      this.score = 0;
      this.extraLifeAwarded = false;

      // Game State Machine: 'title' | 'intro' | 'playing' | 'paused' | 'dying' | 'clearing' | 'gameover' | 'victory'
      this.state = 'title';
      this.stateTimer = 0;
      this.animTick = 0;
      this.loopCount = 0; // Increments on Extra Time loops after beating all 3 caverns

      // Level runtime state
      this.levelIndex = 0;
      this.levelDef = null;
      this.grid = [];
      this.crumble = []; // 2D array of crumble erosion levels (0..8)
      this.crumbleTimers = [];
      this.items = [];
      this.enemies = [];
      this.particles = [];
      this.popups = [];
      this.starsBg = this._makeStars();

      // Match / Player state
      this.lives = 3;
      this.clockRemaining = PHYS.MATCH_DURATION;
      this.tunnelUnlocked = false;
      this.bannerMsg = '';
      this.bannerTimer = 0;
      this.borderFlashTimer = 0;
      this.borderFlashClass = '';
      this.bonusTickAcc = 0;
      this.bonusStep = 0;
      this.switchVisualFlipped = false;

      // Player entity
      this.player = {
        x: 0,
        y: 0,
        w: 10,
        h: 14,
        vx: 0,
        vy: 0,
        facing: 1,
        gDir: 1,            // +1 normal gravity, -1 inverted ceiling gravity
        onGround: false,
        jumpCommitted: false,
        commitVx: 0,
        coyoteTimer: 0,
        jumpBuffer: 0,
        flipCooldown: 0,
        walkCycle: 0,
        inZeroG: false,
        inUpdraft: false,
        conveyorVx: 0,
        lastSwitchKey: null,
      };

      // Input state
      this.keys = {
        left: false,
        right: false,
        jump: false,
        jumpJustPressed: false,
      };

      this._bindInputs();
      this._lastTime = performance.now();
      this._accumulator = 0;
      this._fixedDt = 1 / 60;

      this._frame = this._frame.bind(this);
      requestAnimationFrame(this._frame);
    }

    _loadHighScore() {
      try {
        const val = parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10);
        return Number.isFinite(val) && val > 0 ? val : 2600; // 1926 tribute default!
      } catch (_) {
        return 2600;
      }
    }

    _saveHighScore() {
      if (this.score > this.highScore) {
        this.highScore = this.score;
        try {
          localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
        } catch (_) {}
      }
    }

    _makeStars() {
      const stars = [];
      for (let i = 0; i < 36; i++) {
        stars.push({
          x: 10 + ((i * 53) % (MT.PLAY_W - 20)),
          y: 10 + ((i * 29) % (MT.PLAY_H - 28)),
          phase: i * 0.7,
        });
      }
      return stars;
    }

    _flashBorder(colorName, duration) {
      this.borderFlashClass = 'border-flash-' + colorName;
      this.borderFlashTimer = duration || 0.16;
      if (this.bezelEl) {
        this.bezelEl.className = 'screen-bezel ' + this.borderFlashClass;
      }
    }

    _clearBorderFlash() {
      this.borderFlashTimer = 0;
      this.borderFlashClass = '';
      if (this.bezelEl) {
        this.bezelEl.className = 'screen-bezel';
      }
    }

    _addScore(pts, popupX, popupY, color) {
      this.score += pts;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this._saveHighScore();
      }
      if (!this.extraLifeAwarded && this.score >= 10000) {
        this.extraLifeAwarded = true;
        this.lives = Math.min(5, this.lives + 1);
        this.bannerMsg = 'EXTRA TERRIER LIFE!';
        this.bannerTimer = 2.0;
        MT.audio.playTunnelOpen();
      }
      if (popupX !== undefined && popupY !== undefined) {
        this.popups.push({
          text: '+' + pts,
          x: popupX,
          y: popupY,
          vy: -18,
          life: 0.9,
          color: color || P.YELLOW,
        });
      }
    }

    _spawnParticles(x, y, count, colors, speed) {
      for (let i = 0; i < count; i++) {
        const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
        const spd = (speed || 48) * (0.4 + Math.random() * 0.8);
        this.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.25 + Math.random() * 0.35,
          maxLife: 0.6,
          color: colors[i % colors.length],
          size: Math.random() < 0.35 ? 2 : 1,
        });
      }
    }

    // =========================================================================
    // INPUT BINDINGS (Keyboard + Retro On-Screen Touch Buttons)
    // =========================================================================
    _bindInputs() {
      const unlockAudio = () => {
        try {
          if (MT.audio) MT.audio.ensureContext();
        } catch (_) {}
      };

      const isSpaceKey = (e) =>
        e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar' || e.keyCode === 32;
      const isEnterKey = (e) =>
        e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === 'Enter' || e.keyCode === 13;
      const isLeftKey = (e) =>
        e.code === 'ArrowLeft' || e.code === 'KeyA' || e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.keyCode === 37 || e.keyCode === 65;
      const isRightKey = (e) =>
        e.code === 'ArrowRight' || e.code === 'KeyD' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.keyCode === 39 || e.keyCode === 68;
      const isUpKey = (e) =>
        e.code === 'ArrowUp' || e.code === 'KeyW' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.keyCode === 38 || e.keyCode === 87;
      const isDownKey = (e) =>
        e.code === 'ArrowDown' || e.key === 'ArrowDown' || e.keyCode === 40;

      const onKeyDown = (e) => {
        unlockAudio();
        const code = e.code || '';
        const key = (e.key || '').toLowerCase();

        if (isSpaceKey(e) || isLeftKey(e) || isRightKey(e) || isUpKey(e) || isDownKey(e)) {
          e.preventDefault();
        }

        if (code === 'KeyM' || key === 'm') {
          this.toggleMute();
          return;
        }

        if (code === 'KeyP' || key === 'p') {
          this.togglePause();
          return;
        }

        if (code === 'KeyR' || key === 'r') {
          this.restartAction();
          return;
        }

        // Title / Intro / GameOver / Victory quick starts
        if (this.state === 'title') {
          if (code === 'Digit1' || code === 'Numpad1' || key === '1') {
            this.startNewGame(0);
            return;
          }
          if (code === 'Digit2' || code === 'Numpad2' || key === '2') {
            this.startNewGame(1);
            return;
          }
          if (code === 'Digit3' || code === 'Numpad3' || key === '3') {
            this.startNewGame(2);
            return;
          }
          if (isSpaceKey(e) || isEnterKey(e)) {
            e.preventDefault();
            this.startNewGame(0);
            return;
          }
        } else if (this.state === 'intro') {
          if (isSpaceKey(e) || isEnterKey(e)) {
            e.preventDefault();
            this.state = 'playing';
            this.stateTimer = 0;
            MT.audio.setMusicPlaying(true);
            return;
          }
        } else if (this.state === 'gameover') {
          if (isSpaceKey(e) || isEnterKey(e)) {
            e.preventDefault();
            this.startNewGame(0);
            return;
          }
        } else if (this.state === 'victory') {
          if (isSpaceKey(e) || isEnterKey(e)) {
            e.preventDefault();
            this.startExtraTime();
            return;
          }
        }

        if (isLeftKey(e)) this.keys.left = true;
        if (isRightKey(e)) this.keys.right = true;
        if (isUpKey(e) || isSpaceKey(e)) {
          if (!this.keys.jump) this.keys.jumpJustPressed = true;
          this.keys.jump = true;
        }
      };

      const onKeyUp = (e) => {
        if (isLeftKey(e)) this.keys.left = false;
        if (isRightKey(e)) this.keys.right = false;
        if (isUpKey(e) || isSpaceKey(e)) this.keys.jump = false;
      };

      // Use capture phase on window so Space/Arrows always reach the game even if a button had focus
      global.addEventListener('keydown', onKeyDown, true);
      global.addEventListener('keyup', onKeyUp, true);

      // Clicking canvas or bezel focuses game and starts from title/gameover/victory
      const focusTarget = this.bezelEl || this.canvas;
      focusTarget.addEventListener('pointerdown', () => {
        unlockAudio();
        try { this.canvas.focus({ preventScroll: true }); } catch (_) {}
        if (this.state === 'title' || this.state === 'gameover') {
          this.startNewGame(0);
        } else if (this.state === 'intro') {
          this.state = 'playing';
          this.stateTimer = 0;
          MT.audio.setMusicPlaying(true);
        } else if (this.state === 'victory') {
          this.startExtraTime();
        }
      });

      // Bind retro UI buttons
      const bindHold = (id, keyName) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const down = (e) => {
          e.preventDefault();
          unlockAudio();
          btn.classList.add('pressed');
          if (this.state === 'title' || this.state === 'gameover') {
            this.startNewGame(0);
            return;
          }
          if (this.state === 'victory') {
            this.startExtraTime();
            return;
          }
          if (keyName === 'jump' && !this.keys.jump) {
            this.keys.jumpJustPressed = true;
          }
          this.keys[keyName] = true;
        };
        const up = (e) => {
          e.preventDefault();
          btn.classList.remove('pressed');
          this.keys[keyName] = false;
        };
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointerleave', up);
        btn.addEventListener('pointercancel', up);
      };

      bindHold('btn-left', 'left');
      bindHold('btn-right', 'right');
      bindHold('btn-jump', 'jump');

      const btnMute = document.getElementById('btn-mute');
      if (btnMute) {
        btnMute.addEventListener('click', () => {
          btnMute.blur();
          unlockAudio();
          this.toggleMute();
        });
      }

      const btnPause = document.getElementById('btn-pause');
      if (btnPause) {
        btnPause.addEventListener('click', () => {
          btnPause.blur();
          unlockAudio();
          this.togglePause();
        });
      }

      const btnRestart = document.getElementById('btn-restart');
      if (btnRestart) {
        btnRestart.addEventListener('click', () => {
          btnRestart.blur();
          unlockAudio();
          this.restartAction();
        });
      }

      const btnCrt = document.getElementById('btn-crt');
      const scanlines = document.getElementById('scanlines');
      if (btnCrt && scanlines) {
        btnCrt.addEventListener('click', () => {
          btnCrt.blur();
          const isOff = scanlines.classList.toggle('off');
          btnCrt.textContent = isOff ? 'CRT: OFF' : 'CRT: ON';
        });
      }
    }

    toggleMute() {
      const muted = MT.audio.toggleMute();
      const btnMute = document.getElementById('btn-mute');
      if (btnMute) {
        btnMute.textContent = muted ? '♪ SOUND: OFF' : '♪ SOUND: ON';
        btnMute.classList.toggle('muted', muted);
      }
    }

    togglePause() {
      if (this.state === 'playing') {
        this.state = 'paused';
        MT.audio.setMusicPlaying(false);
      } else if (this.state === 'paused') {
        this.state = 'playing';
        MT.audio.setMusicPlaying(true);
      }
    }

    restartAction() {
      if (this.state === 'title') {
        this.startNewGame(0);
      } else if (this.state === 'gameover' || this.state === 'victory') {
        this.startNewGame(0);
      } else {
        // Restart current cavern cleanly
        this.loadLevel(this.levelIndex, false);
      }
    }

    // =========================================================================
    // GAME FLOW & LEVEL LOADING
    // =========================================================================
    startNewGame(startLevelIndex) {
      this.score = 0;
      this.lives = 3;
      this.loopCount = 0;
      this.extraLifeAwarded = false;
      this.levelIndex = startLevelIndex || 0;
      MT.audio.resetMusic();
      this.loadLevel(this.levelIndex, true);
    }

    startExtraTime() {
      this.loopCount++;
      this.levelIndex = 0;
      this.lives = Math.min(5, this.lives + 1);
      MT.audio.resetMusic();
      this.loadLevel(0, true);
    }

    _createZeroGrid(mapGrid) {
      return mapGrid.map((row) => row.map(() => 0));
    }

    _spawnEnemiesForLevel(def) {
      const speedBoost = 1 + this.loopCount * 0.14;
      return def.enemies.map((en) => ({
        type: en.type,
        x: en.x,
        y: en.y,
        baseY: en.y,
        minX: en.minX,
        maxX: en.maxX,
        speed: en.speed * speedBoost,
        dir: en.dir || 1,
        gDir: en.gDir || 1,
        bobAmp: en.bobAmp || 0,
        bobFreq: en.bobFreq || 3,
        phase: 0,
      }));
    }

    loadLevel(idx, showIntro) {
      const def = MT.LEVELS[idx % MT.LEVELS.length];
      this.levelDef = def;

      // Deep-clone tile grid & crumble states
      this.grid = def.map.map((row) => row.slice());
      this.crumble = this._createZeroGrid(def.map);
      this.crumbleTimers = this._createZeroGrid(def.map);

      // Items
      this.items = def.items.map((it) => ({
        type: it.type,
        x: it.col * MT.TILE,
        y: it.row * MT.TILE,
        points: it.points,
        collected: false,
      }));

      // Enemies (slightly faster in Extra Time loops!)
      this.enemies = this._spawnEnemiesForLevel(def);

      this.particles = [];
      this.popups = [];
      this.tunnelUnlocked = false;
      this.clockRemaining = PHYS.MATCH_DURATION;
      this.bannerMsg = '';
      this.bannerTimer = 0;
      this.switchVisualFlipped = false;

      this._resetPlayer();

      if (showIntro) {
        this.state = 'intro';
        this.stateTimer = 1.55;
        MT.audio.setMusicPlaying(false);
        this._flashBorder('blue', 0.25);
      } else {
        this.state = 'playing';
        MT.audio.setMusicPlaying(true);
      }
    }

    _resetPlayer() {
      const sp = this.levelDef.spawn;
      this.player.x = sp.col * MT.TILE + 3;
      this.player.y = sp.row * MT.TILE + 2; // feet flush on top of row+2
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.facing = sp.facing || 1;
      this.player.gDir = sp.gDir || 1;
      this.player.onGround = false;
      this.player.jumpCommitted = false;
      this.player.commitVx = 0;
      this.player.coyoteTimer = 0;
      this.player.jumpBuffer = 0;
      this.player.flipCooldown = 0;
      this.player.walkCycle = 0;
      this.player.inZeroG = false;
      this.player.inUpdraft = false;
      this.player.conveyorVx = 0;
      this.player.lastSwitchKey = null;
      this.switchVisualFlipped = this.player.gDir < 0;
    }

    _triggerDeath(reason) {
      if (this.state !== 'playing') return;
      this.state = 'dying';
      this.stateTimer = 1.15;
      this.bannerMsg = reason || 'RED CARD! FOUL!';
      this.bannerTimer = 1.15;
      MT.audio.setMusicPlaying(false);
      MT.audio.playDeath();
      this._flashBorder('red', 0.35);
      this._spawnParticles(
        this.player.x + this.player.w / 2,
        this.player.y + this.player.h / 2,
        18,
        [P.BLUE, P.WHITE, P.YELLOW, P.RED],
        72
      );
    }

    _triggerGravityFlip() {
      const pl = this.player;
      pl.gDir *= -1;
      pl.onGround = false;
      pl.jumpCommitted = false;
      pl.vy = 52 * pl.gDir; // Crisp initial launch toward opposite surface
      pl.flipCooldown = PHYS.FLIP_COOLDOWN;
      this.switchVisualFlipped = pl.gDir < 0;
      MT.audio.playGravityFlip(pl.gDir);
      this._flashBorder('magenta', 0.18);
      this._spawnParticles(
        pl.x + pl.w / 2,
        pl.y + pl.h / 2,
        14,
        [P.MAGENTA, P.CYAN, P.WHITE],
        58
      );
      this.bannerMsg = pl.gDir < 0 ? 'GRAVITY INVERTED!' : 'GRAVITY NORMAL!';
      this.bannerTimer = 1.05;
    }

    // =========================================================================
    // TILE & ZONE HELPERS
    // =========================================================================
    _getTile(col, row) {
      if (col < 0 || col >= MT.COLS || row < 0 || row >= MT.ROWS) {
        return T.WALL;
      }
      return this.grid[row][col];
    }

    _isSolidAt(col, row) {
      const tile = this._getTile(col, row);
      if (tile === T.CRUMBLE) {
        return this.crumble[row][col] < 8;
      }
      return (
        tile === T.SOLID ||
        tile === T.WALL ||
        tile === T.CONVEYOR_L ||
        tile === T.CONVEYOR_R ||
        tile === T.GRAV_PAD ||
        tile === T.FLOOD_LAMP
      );
    }

    _checkZones(px, py, pw, ph) {
      const cx = px + pw * 0.5;
      const cy = py + ph * 0.5;
      let inZeroG = false;
      let inUpdraft = false;

      const zones = this.levelDef ? this.levelDef.zones : [];
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i];
        const zx = z.col * MT.TILE;
        const zy = z.row * MT.TILE;
        const zw = z.w * MT.TILE;
        const zh = z.h * MT.TILE;
        if (cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh) {
          if (z.type === 'zerog') inZeroG = true;
          if (z.type === 'updraft') inUpdraft = true;
        }
      }
      return { inZeroG, inUpdraft };
    }

    // =========================================================================
    // MAIN LOOP (Fixed 60Hz Simulation + Smooth Render)
    // =========================================================================
    _frame(now) {
      const rawDt = Math.min(0.05, Math.max(0, (now - this._lastTime) / 1000));
      this._lastTime = now;
      this._accumulator += rawDt;

      while (this._accumulator >= this._fixedDt) {
        this._update(this._fixedDt);
        this._accumulator -= this._fixedDt;
      }

      this._render();
      requestAnimationFrame(this._frame);
    }

    _update(dt) {
      this.animTick += dt;

      if (this.borderFlashTimer > 0) {
        this.borderFlashTimer -= dt;
        if (this.borderFlashTimer <= 0) {
          this._clearBorderFlash();
        }
      }

      if (this.bannerTimer > 0) {
        this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      }

      this._updateParticles(dt);

      if (this.state === 'intro') {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'playing';
          MT.audio.setMusicPlaying(true);
        }
        this.keys.jumpJustPressed = false;
        return;
      }

      if (this.state === 'dying') {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.lives--;
          if (this.lives <= 0) {
            this.state = 'gameover';
            this._saveHighScore();
            MT.audio.playGameOver();
          } else {
            // Reset crumbling tiles & enemies cleanly for next life, keep collected items!
            this.crumble = this._createZeroGrid(this.levelDef.map);
            this.crumbleTimers = this._createZeroGrid(this.levelDef.map);
            this.enemies = this._spawnEnemiesForLevel(this.levelDef);
            this.clockRemaining = PHYS.MATCH_DURATION;
            this._resetPlayer();
            this.state = 'playing';
            MT.audio.setMusicPlaying(true);
          }
        }
        this.keys.jumpJustPressed = false;
        return;
      }

      if (this.state === 'clearing') {
        // Rapidly drain remaining Match Clock into bonus points!
        this.bonusTickAcc += dt;
        if (this.clockRemaining > 0) {
          const drainRate = 54; // fast retro score tally
          const delta = Math.min(this.clockRemaining, drainRate * dt);
          this.clockRemaining -= delta;
          if (this.bonusTickAcc >= 0.045) {
            this.bonusTickAcc = 0;
            this._addScore(25);
            MT.audio.playBonusTick(this.bonusStep++);
          }
        } else {
          this.stateTimer -= dt;
          if (this.stateTimer <= 0) {
            if (this.levelIndex + 1 < MT.LEVELS.length) {
              this.levelIndex++;
              this.loadLevel(this.levelIndex, true);
            } else {
              this.state = 'victory';
              this._saveHighScore();
              MT.audio.setMusicPlaying(false);
              MT.audio.playVictory();
              this._flashBorder('yellow', 0.4);
            }
          }
        }
        this.keys.jumpJustPressed = false;
        return;
      }

      if (this.state === 'victory') {
        if (Math.random() < 0.14) {
          this._spawnParticles(
            24 + Math.random() * 208,
            20 + Math.random() * 100,
            12,
            [P.BLUE, P.WHITE, P.CYAN, P.YELLOW, P.MAGENTA],
            54
          );
        }
        this.keys.jumpJustPressed = false;
        return;
      }

      if (this.state !== 'playing') {
        this.keys.jumpJustPressed = false;
        return;
      }

      // ---- PLAYING STATE ----
      // Update 90-Minute Match Clock (Air Bar)
      this.clockRemaining = Math.max(0, this.clockRemaining - dt);
      MT.audio.setClockRatio(this.clockRemaining / PHYS.MATCH_DURATION);
      MT.audio.updateMusic(dt);

      if (this.clockRemaining <= 0) {
        this._triggerDeath('FULL TIME! CLOCK EXPIRED!');
        this.keys.jumpJustPressed = false;
        return;
      }

      this._updatePlayer(dt);
      this._updateEnemies(dt);
      this._checkInteractions();

      this.keys.jumpJustPressed = false;
    }

    _updatePlayer(dt) {
      const pl = this.player;
      const gDir = pl.gDir;

      if (pl.flipCooldown > 0) pl.flipCooldown -= dt;
      if (pl.coyoteTimer > 0) pl.coyoteTimer -= dt;
      if (pl.jumpBuffer > 0) pl.jumpBuffer -= dt;
      if (this.keys.jumpJustPressed) pl.jumpBuffer = PHYS.JUMP_BUFFER;

      // Zone detection
      const prevZeroG = pl.inZeroG;
      const zone = this._checkZones(pl.x, pl.y, pl.w, pl.h);
      pl.inZeroG = zone.inZeroG;
      pl.inUpdraft = zone.inUpdraft;

      // Entering Zero-G or Updraft unlocks mid-air float steering!
      if ((pl.inZeroG && !prevZeroG) || pl.inUpdraft) {
        pl.jumpCommitted = false;
      }

      const inputX = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
      if (inputX !== 0) pl.facing = inputX;

      // Horizontal velocity logic: Classic Manic Miner committed jump arc on normal jumps,
      // smooth mid-air drift control inside Zero-G floodlights & wind updrafts!
      if (pl.onGround) {
        pl.vx = inputX * PHYS.RUN_SPEED + pl.conveyorVx;
        if (inputX !== 0) {
          pl.walkCycle += dt * 11;
        } else {
          pl.walkCycle = 0;
        }
      } else if (pl.inZeroG || pl.inUpdraft) {
        const targetVx = inputX * PHYS.ZEROG_AIR_STEER;
        pl.vx += (targetVx - pl.vx) * Math.min(1, dt * 8);
      } else if (pl.jumpCommitted) {
        pl.vx = pl.commitVx;
      } else {
        // Walked off a ledge or mid gravity-flip: allow gentle air steering so flips feel great
        const targetVx = inputX * (PHYS.RUN_SPEED * 0.72);
        pl.vx += (targetVx - pl.vx) * Math.min(1, dt * 7);
      }

      // Jump execution (supports coyote time + jump buffer)
      if (pl.jumpBuffer > 0 && (pl.onGround || pl.coyoteTimer > 0)) {
        const jv = pl.inZeroG ? PHYS.ZEROG_JUMP_VY : PHYS.JUMP_VY;
        pl.vy = -jv * gDir;
        pl.onGround = false;
        pl.coyoteTimer = 0;
        pl.jumpBuffer = 0;

        if (!pl.inZeroG && !pl.inUpdraft) {
          // Authentic Manic Miner committed jump velocity!
          pl.jumpCommitted = true;
          pl.commitVx = inputX * PHYS.RUN_SPEED + pl.conveyorVx * 0.5;
          pl.vx = pl.commitVx;
        } else {
          pl.jumpCommitted = false;
        }

        MT.audio.playJump(pl.inZeroG || pl.inUpdraft);
        this._spawnParticles(
          pl.x + pl.w / 2,
          gDir > 0 ? pl.y + pl.h : pl.y,
          5,
          pl.inZeroG ? [P.CYAN, P.WHITE] : [P.WHITE, P.YELLOW],
          26
        );
      }

      // Vertical acceleration (Gravity / Zero-G / Updraft)
      if (pl.inUpdraft && gDir > 0) {
        // Upward antigravity wind stream on Castle Hill!
        pl.vy -= PHYS.UPDRAFT_ACCEL * dt;
        if (this.keys.jump) pl.vy -= 90 * dt;
        if (pl.vy < -PHYS.UPDRAFT_MAX_VY) pl.vy = -PHYS.UPDRAFT_MAX_VY;
        if (pl.vy > 48) pl.vy = 48;
      } else if (pl.inZeroG) {
        const g = PHYS.GRAVITY * PHYS.ZEROG_GRAV_MULT * gDir;
        pl.vy += g * dt;
        if (gDir > 0 && pl.vy > PHYS.ZEROG_MAX_FALL) pl.vy = PHYS.ZEROG_MAX_FALL;
        if (gDir < 0 && pl.vy < -PHYS.ZEROG_MAX_FALL) pl.vy = -PHYS.ZEROG_MAX_FALL;
      } else {
        pl.vy += PHYS.GRAVITY * gDir * dt;
        if (gDir > 0 && pl.vy > PHYS.MAX_FALL) pl.vy = PHYS.MAX_FALL;
        if (gDir < 0 && pl.vy < -PHYS.MAX_FALL) pl.vy = -PHYS.MAX_FALL;
      }

      // --- Move X & Resolve Horizontal Collisions ---
      pl.x += pl.vx * dt;
      const topRow = Math.floor((pl.y + 1) / MT.TILE);
      const botRow = Math.floor((pl.y + pl.h - 1) / MT.TILE);

      if (pl.vx > 0) {
        const rightCol = Math.floor((pl.x + pl.w) / MT.TILE);
        for (let r = topRow; r <= botRow; r++) {
          if (this._isSolidAt(rightCol, r)) {
            pl.x = rightCol * MT.TILE - pl.w - 0.01;
            pl.vx = 0;
            if (pl.jumpCommitted) pl.commitVx = 0;
            break;
          }
        }
      } else if (pl.vx < 0) {
        const leftCol = Math.floor(pl.x / MT.TILE);
        for (let r = topRow; r <= botRow; r++) {
          if (this._isSolidAt(leftCol, r)) {
            pl.x = (leftCol + 1) * MT.TILE + 0.01;
            pl.vx = 0;
            if (pl.jumpCommitted) pl.commitVx = 0;
            break;
          }
        }
      }

      // --- Move Y & Resolve Vertical Collisions ---
      const wasOnGround = pl.onGround;
      pl.onGround = false;
      pl.conveyorVx = 0;

      pl.y += pl.vy * dt;
      const leftCol = Math.floor((pl.x + 1) / MT.TILE);
      const rightCol = Math.floor((pl.x + pl.w - 1) / MT.TILE);

      if (pl.vy > 0) {
        const footRow = Math.floor((pl.y + pl.h) / MT.TILE);
        for (let c = leftCol; c <= rightCol; c++) {
          if (this._isSolidAt(c, footRow)) {
            pl.y = footRow * MT.TILE - pl.h;
            pl.vy = 0;
            if (gDir > 0) {
              pl.onGround = true;
              pl.jumpCommitted = false;
            }
            break;
          }
        }
      } else if (pl.vy < 0) {
        const headRow = Math.floor(pl.y / MT.TILE);
        for (let c = leftCol; c <= rightCol; c++) {
          if (this._isSolidAt(c, headRow)) {
            pl.y = (headRow + 1) * MT.TILE;
            pl.vy = 0;
            if (gDir < 0) {
              pl.onGround = true;
              pl.jumpCommitted = false;
            }
            break;
          }
        }
      }

      // Also check static ground contact if vy was 0
      if (!pl.onGround) {
        const probeRow = gDir > 0
          ? Math.floor((pl.y + pl.h + 0.5) / MT.TILE)
          : Math.floor((pl.y - 0.5) / MT.TILE);
        for (let c = leftCol; c <= rightCol; c++) {
          if (this._isSolidAt(c, probeRow)) {
            if (gDir > 0 && Math.abs((pl.y + pl.h) - probeRow * MT.TILE) <= 1.2) {
              pl.y = probeRow * MT.TILE - pl.h;
              pl.onGround = true;
              pl.jumpCommitted = false;
              break;
            } else if (gDir < 0 && Math.abs(pl.y - (probeRow + 1) * MT.TILE) <= 1.2) {
              pl.y = (probeRow + 1) * MT.TILE;
              pl.onGround = true;
              pl.jumpCommitted = false;
              break;
            }
          }
        }
      }

      if (wasOnGround && !pl.onGround && pl.vy * gDir >= 0) {
        pl.coyoteTimer = PHYS.COYOTE_TIME;
      }

      // Surface tile effects (Conveyors, Crumbling Terrace Tiles, Gravity-Flip Pads)
      if (pl.onGround) {
        const supportRow = gDir > 0
          ? Math.floor((pl.y + pl.h + 1) / MT.TILE)
          : Math.floor((pl.y - 1) / MT.TILE);
        let convSum = 0;
        let convCount = 0;
        let hitGravPad = false;

        for (let c = leftCol; c <= rightCol; c++) {
          const tile = this._getTile(c, supportRow);
          if (tile === T.CONVEYOR_L) {
            convSum -= PHYS.CONVEYOR_PULL;
            convCount++;
          } else if (tile === T.CONVEYOR_R) {
            convSum += PHYS.CONVEYOR_PULL;
            convCount++;
          } else if (tile === T.CRUMBLE && this.crumble[supportRow][c] < 8) {
            this.crumbleTimers[supportRow][c] += dt;
            if (this.crumbleTimers[supportRow][c] >= PHYS.CRUMBLE_INTERVAL) {
              this.crumbleTimers[supportRow][c] = 0;
              this.crumble[supportRow][c]++;
              MT.audio.playCrumble();
              this._spawnParticles(
                c * MT.TILE + 4,
                supportRow * MT.TILE + (gDir > 0 ? 4 : 4),
                2,
                [P.CYAN, P.WHITE, P.BLUE],
                22
              );
            }
          } else if (tile === T.GRAV_PAD) {
            hitGravPad = true;
          }
        }

        if (convCount > 0) {
          pl.conveyorVx = convSum / convCount;
        }
        if (hitGravPad && pl.flipCooldown <= 0) {
          this._triggerGravityFlip();
        }
      }
    }

    _updateEnemies(dt) {
      for (let i = 0; i < this.enemies.length; i++) {
        const en = this.enemies[i];
        en.x += en.speed * en.dir * dt;
        if (en.x <= en.minX) {
          en.x = en.minX;
          en.dir = 1;
        } else if (en.x >= en.maxX) {
          en.x = en.maxX;
          en.dir = -1;
        }

        if (en.type === 'pie') {
          en.phase += dt * en.bobFreq;
          en.y = en.baseY + Math.sin(en.phase) * en.bobAmp;
        }
      }
    }

    _checkInteractions() {
      const pl = this.player;
      const px1 = pl.x + 1;
      const py1 = pl.y + 1;
      const px2 = pl.x + pl.w - 1;
      const py2 = pl.y + pl.h - 1;

      // 1. Check tile hazards (Rogue Corner Flags) & Interactive Gravity-Flip Switches
      const c1 = Math.floor(px1 / MT.TILE);
      const c2 = Math.floor(px2 / MT.TILE);
      const r1 = Math.floor(py1 / MT.TILE);
      const r2 = Math.floor(py2 / MT.TILE);

      let touchingSwitchKey = null;

      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const tile = this._getTile(c, r);
          if (tile === T.FLAG_UP || tile === T.FLAG_DOWN) {
            // Fair inset check on corner flag tile
            const fx1 = c * MT.TILE + 2;
            const fy1 = r * MT.TILE + 1;
            const fx2 = c * MT.TILE + 6;
            const fy2 = r * MT.TILE + 7;
            if (px2 > fx1 && px1 < fx2 && py2 > fy1 && py1 < fy2) {
              this._triggerDeath('ROGUE CORNER FLAG!');
              return;
            }
          } else if (tile === T.SWITCH) {
            touchingSwitchKey = c + ',' + r;
          }
        }
      }

      if (touchingSwitchKey && touchingSwitchKey !== pl.lastSwitchKey && pl.flipCooldown <= 0) {
        pl.lastSwitchKey = touchingSwitchKey;
        this._triggerGravityFlip();
      } else if (!touchingSwitchKey) {
        pl.lastSwitchKey = null;
      }

      // 2. Check Collectibles
      let remaining = 0;
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        if (it.collected) continue;
        const ix1 = it.x;
        const iy1 = it.y;
        const ix2 = it.x + 10;
        const iy2 = it.y + 10;
        if (px2 > ix1 && px1 < ix2 && py2 > iy1 && py1 < iy2) {
          it.collected = true;
          const leftCount = this.items.filter((x) => !x.collected).length;
          const col = it.type === 'trophy' ? P.MAGENTA : (it.type === 'star' ? P.CYAN : P.YELLOW);
          this._addScore(it.points, it.x + 4, it.y, col);
          this._spawnParticles(it.x + 5, it.y + 5, 12, [P.YELLOW, P.CYAN, P.WHITE, P.MAGENTA], 54);
          MT.audio.playPickup(leftCount === 0);
          this._flashBorder(leftCount === 0 ? 'yellow' : 'cyan', leftCount === 0 ? 0.30 : 0.12);
          if (leftCount === 0) {
            this.tunnelUnlocked = true;
            this.bannerMsg = 'TUNNEL TO THE PITCH OPEN!';
            this.bannerTimer = 2.4;
          }
        } else {
          remaining++;
        }
      }

      // 3. Check Enemies (Referees & Flying Meat Pies)
      for (let i = 0; i < this.enemies.length; i++) {
        const en = this.enemies[i];
        const ew = en.type === 'pie' ? 12 : 9;
        const eh = en.type === 'pie' ? 8 : 11;
        const ex = en.x + (en.type === 'pie' ? 2 : 3.5);
        const ey = en.type === 'pie' ? en.y + 2 : (en.gDir < 0 ? en.y + 1 : en.y + 4);
        if (px2 > ex && px1 < ex + ew && py2 > ey && py1 < ey + eh) {
          const msg = en.type === 'pie' ? 'HIT BY FLYING MEAT PIE!' : 'SENT OFF! RED CARD!';
          this._triggerDeath(msg);
          return;
        }
      }

      // 4. Check Tunnel to the Pitch Exit Door
      if (this.tunnelUnlocked) {
        const tx = this.levelDef.tunnel.col * MT.TILE;
        const ty = this.levelDef.tunnel.row * MT.TILE;
        if (px2 > tx + 2 && px1 < tx + 14 && py2 > ty + 2 && py1 < ty + 15) {
          this.state = 'clearing';
          this.stateTimer = 1.0;
          this.bonusTickAcc = 0;
          this.bonusStep = 0;
          this.bannerMsg = 'CAVERN CLEARED! CLOCK BONUS!';
          this.bannerTimer = 2.5;
          MT.audio.setMusicPlaying(false);
          MT.audio.playLevelClear();
          this._flashBorder('yellow', 0.35);
          this._spawnParticles(tx + 8, ty + 8, 22, [P.BLUE, P.WHITE, P.YELLOW, P.CYAN], 74);
        }
      }
    }

    _updateParticles(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.life -= dt;
        if (pt.life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const pop = this.popups[i];
        pop.y += pop.vy * dt;
        pop.life -= dt;
        if (pop.life <= 0) this.popups.splice(i, 1);
      }
    }

    // =========================================================================
    // RENDERING PIPELINE (256x208 Native Pixel Art)
    // =========================================================================
    _render() {
      const ctx = this.ctx;
      ctx.fillStyle = P.BLACK;
      ctx.fillRect(0, 0, MT.SCREEN_W, MT.SCREEN_H);

      if (this.state === 'title') {
        this._renderTitleScreen(ctx);
        return;
      }

      if (this.state === 'gameover') {
        this._renderPlayfield(ctx);
        this._renderHUD(ctx);
        this._renderOverlayBox(ctx, 'FULL TIME - GAME OVER', [
          'FINAL SCORE: ' + String(this.score).padStart(6, '0'),
          'HIGH SCORE:  ' + String(this.highScore).padStart(6, '0'),
          '',
          'PRESS SPACE OR R TO REPLAY',
        ], P.RED);
        return;
      }

      if (this.state === 'victory') {
        this._renderVictoryScreen(ctx);
        return;
      }

      this._renderPlayfield(ctx);
      this._renderHUD(ctx);

      if (this.state === 'intro') {
        this._renderOverlayBox(ctx, 'CAVERN ' + this.levelDef.id + ' OF ' + MT.LEVELS.length, [
          this.levelDef.name,
          this.levelDef.subtitle,
          this.loopCount > 0 ? 'EXTRA TIME LOOP ' + (this.loopCount + 1) + '!' : 'GET READY, TERRY!',
        ], P.CYAN);
      } else if (this.state === 'paused') {
        this._renderOverlayBox(ctx, 'HALF-TIME PAUSE', [
          'PRESS P TO RESUME',
          'PRESS R TO RESTART CAVERN',
        ], P.YELLOW);
      }
    }

    _renderPlayfield(ctx) {
      const def = this.levelDef;
      if (!def) return;

      // 1. Subtle Atmospheric Theme Background (high-contrast pitch black base)
      if (def.theme === 'castle') {
        // Twinkling Yorkshire night stars
        for (let i = 0; i < this.starsBg.length; i++) {
          const st = this.starsBg[i];
          const bright = Math.sin(this.animTick * 3 + st.phase) > 0.2;
          ctx.fillStyle = bright ? P.CYAN : P.DARK_BLUE;
          ctx.fillRect(st.x, st.y, 1, 1);
        }
      } else if (def.theme === 'vault') {
        // Faint vaulted pillars in background
        ctx.fillStyle = '#091028';
        ctx.fillRect(104, 8, 2, MT.PLAY_H - 16);
        ctx.fillRect(150, 8, 2, MT.PLAY_H - 16);
      }

      // 2. Render Antigravity Zones (Zero-G Floodlight Beams & Updraft Wind Streams)
      for (let i = 0; i < def.zones.length; i++) {
        const z = def.zones[i];
        const zx = z.col * MT.TILE;
        const zy = z.row * MT.TILE;
        const zw = z.w * MT.TILE;
        const zh = z.h * MT.TILE;

        if (z.type === 'zerog') {
          // Luminous Zero-G Stadium Floodlight Beam
          ctx.fillStyle = 'rgba(0, 255, 255, 0.11)';
          ctx.fillRect(zx, zy, zw, zh);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.fillRect(zx + 4, zy, zw - 8, zh);
          // Crisp dashed border rays
          ctx.fillStyle = P.CYAN;
          for (let ry = zy; ry < zy + zh; ry += 6) {
            const off = Math.floor(this.animTick * 18) % 6;
            const py = zy + ((ry - zy + off) % zh);
            ctx.fillRect(zx, py, 1, 3);
            ctx.fillRect(zx + zw - 1, py, 1, 3);
          }
          // Floating Zero-G anti-grav motes
          for (let m = 0; m < 8; m++) {
            const mx = zx + 3 + ((m * 11 + Math.floor(Math.sin(this.animTick + m) * 4)) % (zw - 6));
            const my = zy + (((m * 19) - Math.floor(this.animTick * 14)) % zh + zh) % zh;
            ctx.fillStyle = (m % 2 === 0) ? P.WHITE : P.CYAN;
            ctx.fillRect(mx, my, 1, 1);
          }
        } else if (z.type === 'updraft') {
          // Animated Castle Hill upward antigravity wind stream!
          ctx.fillStyle = 'rgba(0, 85, 255, 0.15)';
          ctx.fillRect(zx, zy, zw, zh);
          for (let s = 0; s < 10; s++) {
            const sx = zx + 2 + ((s * 7) % (zw - 4));
            const sy = zy + (((s * 17) - Math.floor(this.animTick * 52)) % zh + zh) % zh;
            ctx.fillStyle = (s % 2 === 0) ? P.CYAN : P.WHITE;
            ctx.fillRect(sx, sy, 1, 6);
            if (sy > zy + 2) {
              ctx.fillRect(sx - 1, sy + 1, 1, 1);
              ctx.fillRect(sx + 1, sy + 1, 1, 1);
            }
          }
        }
      }

      // 3. Render Tile Grid
      for (let r = 0; r < MT.ROWS; r++) {
        for (let c = 0; c < MT.COLS; c++) {
          const tile = this.grid[r][c];
          if (tile === T.EMPTY) continue;
          const tileArg = (tile === T.SWITCH && r > 0 && this._isSolidAt(c, r - 1))
            ? 'ceiling'
            : this.player.gDir;
          MT.drawTile(
            ctx,
            tile,
            c * MT.TILE,
            r * MT.TILE,
            def.theme,
            this.animTick,
            this.crumble[r][c],
            tileArg,
            this.switchVisualFlipped
          );
        }
      }

      // 4. Render Tunnel to the Pitch Exit Door
      MT.drawTunnel(
        ctx,
        def.tunnel.col * MT.TILE,
        def.tunnel.row * MT.TILE,
        this.tunnelUnlocked,
        this.animTick
      );

      // 5. Render Collectibles (Glowing Footballs, Championship Stars, 1926 Trophies)
      const itemFrame = Math.floor(this.animTick * 6) % 2;
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        if (it.collected) continue;
        const bob = Math.round(Math.sin(this.animTick * 5 + i) * 1.2);
        const spr = MT.sprites.items[it.type][itemFrame];
        ctx.drawImage(spr, Math.round(it.x), Math.round(it.y + bob));
      }

      // 6. Render Enemies (Strict Referees, Victorian Referees, Flying Meat Pies)
      const enFrame = Math.floor(this.animTick * 7) % 2;
      for (let i = 0; i < this.enemies.length; i++) {
        const en = this.enemies[i];
        if (en.type === 'pie') {
          ctx.drawImage(MT.sprites.pie[enFrame], Math.round(en.x), Math.round(en.y));
        } else {
          const set = en.type === 'vreferee' ? MT.sprites.vreferee : MT.sprites.referee;
          let list;
          if (en.gDir < 0) {
            list = en.dir >= 0 ? set.rightInv : set.leftInv;
          } else {
            list = en.dir >= 0 ? set.right : set.left;
          }
          ctx.drawImage(list[enFrame], Math.round(en.x), Math.round(en.y));
        }
      }

      // 7. Render Terry the Terrier
      if (this.state !== 'dying' || Math.floor(this.animTick * 20) % 2 === 0) {
        this._renderPlayer(ctx);
      }

      // 8. Particles & Floating Score Popups
      for (let i = 0; i < this.particles.length; i++) {
        const pt = this.particles[i];
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
      }

      for (let i = 0; i < this.popups.length; i++) {
        const pop = this.popups[i];
        MT.drawText(ctx, pop.text, pop.x - 6, pop.y, pop.color, 1, P.BLACK);
      }

      // 9. Flashing Status Banner inside playfield (e.g. "TUNNEL TO THE PITCH OPEN!")
      if (this.bannerTimer > 0 && this.bannerMsg) {
        const bw = MT.measureText(this.bannerMsg, 1) + 12;
        const bx = Math.floor((MT.SCREEN_W - bw) / 2);
        const by = 14;
        ctx.fillStyle = P.BLACK;
        ctx.fillRect(bx, by, bw, 13);
        ctx.strokeStyle = (Math.floor(this.animTick * 12) % 2) ? P.YELLOW : P.CYAN;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 12);
        MT.drawTextCentered(ctx, this.bannerMsg, MT.SCREEN_W / 2, by + 3, P.WHITE, 1);
      }
    }

    _renderPlayer(ctx) {
      const pl = this.player;
      const set = !pl.onGround
        ? MT.sprites.terry.jump
        : (Math.abs(pl.vx) > 4 ? MT.sprites.terry.walk : MT.sprites.terry.idle);

      let frames;
      if (pl.gDir < 0) {
        frames = pl.facing >= 0 ? set.rightInv : set.leftInv;
      } else {
        frames = pl.facing >= 0 ? set.right : set.left;
      }

      const idx = Math.floor(pl.walkCycle) % frames.length;
      const spr = frames[idx];
      const drawX = Math.round(pl.x - 3);
      const drawY = Math.round(pl.gDir > 0 ? pl.y - 2 : pl.y);

      // Subtle cyan aura when Terry is floating in Zero-G or Updraft!
      if (pl.inZeroG || pl.inUpdraft) {
        ctx.fillStyle = (Math.floor(this.animTick * 12) % 2) ? 'rgba(0,255,255,0.28)' : 'rgba(255,0,255,0.22)';
        ctx.fillRect(drawX - 1, drawY - 1, 18, 18);
      }

      ctx.drawImage(spr, drawX, drawY);
    }

    // =========================================================================
    // RETRO ZX SPECTRUM HUD (y = 144..208)
    // =========================================================================
    _renderHUD(ctx) {
      const y0 = MT.HUD_Y;

      // Pitch-black HUD background
      ctx.fillStyle = P.BLACK;
      ctx.fillRect(0, y0, MT.SCREEN_W, MT.HUD_H);

      // Row 1: Cavern Name Banner (classic Manic Miner full-width colored bar)
      ctx.fillStyle = P.BLUE;
      ctx.fillRect(0, y0, MT.SCREEN_W, 12);
      ctx.fillStyle = P.WHITE;
      ctx.fillRect(0, y0, MT.SCREEN_W, 1);
      ctx.fillRect(0, y0 + 11, MT.SCREEN_W, 1);
      const cavernTitle = this.levelDef ? this.levelDef.name : 'MANIC TERRIER';
      MT.drawTextCentered(ctx, cavernTitle, MT.SCREEN_W / 2, y0 + 3, P.YELLOW, 1, P.BLACK);

      // Row 2: 90-Minute Match Clock (Air/O2 Bar)
      const ratio = Math.max(0, Math.min(1, this.clockRemaining / PHYS.MATCH_DURATION));
      const elapsedMins = Math.min(90, Math.floor((1 - ratio) * 90));
      const minStr = String(elapsedMins).padStart(2, '0') + "'";

      MT.drawText(ctx, 'CLOCK', 4, y0 + 16, P.WHITE, 1);
      const barX = 38;
      const barY = y0 + 15;
      const barW = 186;
      const barH = 9;

      // Bar frame
      ctx.fillStyle = P.DARK_BLUE;
      ctx.fillRect(barX, barY, barW, barH);
      // Danger red zone on left (classic Manic Miner air bar look!)
      ctx.fillStyle = '#440000';
      ctx.fillRect(barX + 1, barY + 1, Math.floor(barW * 0.25), barH - 2);

      // Shrinking Match Clock bar fill
      const fillW = Math.max(0, Math.round((barW - 2) * ratio));
      let barCol = P.CYAN;
      if (ratio < 0.20) {
        barCol = (Math.floor(this.animTick * 12) % 2) ? P.RED : P.YELLOW;
      } else if (ratio < 0.40) {
        barCol = P.YELLOW;
      } else {
        barCol = P.GREEN;
      }
      if (fillW > 0) {
        ctx.fillStyle = barCol;
        ctx.fillRect(barX + 1, barY + 1, fillW, barH - 2);
        // Bright tip highlight
        ctx.fillStyle = P.WHITE;
        ctx.fillRect(barX + fillW, barY + 1, 1, barH - 2);
      }

      // 90' minute readout
      const minCol = ratio < 0.25 ? P.RED : P.YELLOW;
      MT.drawText(ctx, minStr, barX + barW + 5, y0 + 16, minCol, 1);

      // Row 3: High Score & Score
      MT.drawText(ctx, 'HI-SCORE ' + String(this.highScore).padStart(6, '0'), 4, y0 + 29, P.CYAN, 1);
      MT.drawText(ctx, 'SCORE ' + String(this.score).padStart(6, '0'), 146, y0 + 29, P.YELLOW, 1);

      // Divider rule
      ctx.fillStyle = P.DARK_BLUE;
      ctx.fillRect(4, y0 + 39, MT.SCREEN_W - 8, 1);

      // Row 4: Lives (Animated Terry icons) + Gravity Mode Badge + Items Left
      for (let i = 0; i < this.lives; i++) {
        const bounce = (Math.floor(this.animTick * 4 + i) % 2) === 0 ? 0 : 1;
        ctx.drawImage(MT.sprites.terry.icon, 5 + i * 13, y0 + 44 + bounce);
      }

      // Gravity / Antigravity Status Pill
      let gravLabel = 'GRAV:NORM';
      let gravCol = P.BLUE;
      if (this.player.inUpdraft) {
        gravLabel = 'WIND LIFT';
        gravCol = P.CYAN;
      } else if (this.player.inZeroG) {
        gravLabel = 'ZERO-G!';
        gravCol = P.CYAN;
      } else if (this.player.gDir < 0) {
        gravLabel = 'INVERTED!';
        gravCol = P.MAGENTA;
      }
      ctx.fillStyle = gravCol;
      ctx.fillRect(78, y0 + 44, 62, 11);
      ctx.fillStyle = P.BLACK;
      ctx.fillRect(79, y0 + 45, 60, 9);
      MT.drawTextCentered(ctx, gravLabel, 109, y0 + 46, gravCol === P.BLUE ? P.WHITE : gravCol, 1);

      // Items remaining / Tunnel Open status
      const totalItems = this.items.length;
      const gotItems = this.items.filter((x) => x.collected).length;
      if (this.tunnelUnlocked) {
        const col = (Math.floor(this.animTick * 10) % 2) ? P.YELLOW : P.GREEN;
        MT.drawText(ctx, 'TUNNEL OPEN!', 148, y0 + 46, col, 1);
      } else {
        MT.drawText(ctx, 'ITEMS:' + gotItems + '/' + totalItems, 148, y0 + 46, P.WHITE, 1);
      }

      // Audio status indicator
      MT.drawText(ctx, MT.audio.muted ? 'MUTE' : 'SFX', 226, y0 + 46, MT.audio.muted ? P.MAGENTA : P.CYAN, 1);
    }

    // =========================================================================
    // RETRO ZX SPECTRUM TITLE SCREEN
    // =========================================================================
    _renderTitleScreen(ctx) {
      // Animated ZX Spectrum loading stripe bars at top & bottom
      const stripeCols = [P.BLUE, P.WHITE, P.CYAN, P.YELLOW, P.MAGENTA];
      for (let i = 0; i < 32; i++) {
        const ci = (i + Math.floor(this.animTick * 8)) % stripeCols.length;
        ctx.fillStyle = stripeCols[ci];
        ctx.fillRect(i * 8, 0, 8, 4);
        ctx.fillRect(i * 8, MT.SCREEN_H - 4, 8, 4);
      }

      // Starfield backdrop
      for (let i = 0; i < this.starsBg.length; i++) {
        const st = this.starsBg[i];
        ctx.fillStyle = (Math.floor(this.animTick * 3 + i) % 3 === 0) ? P.CYAN : P.DARK_BLUE;
        ctx.fillRect(st.x, st.y + 12, 1, 1);
      }

      // HTAFC Crest Ribbon
      ctx.fillStyle = P.BLUE;
      ctx.fillRect(14, 10, 228, 12);
      ctx.fillStyle = P.WHITE;
      ctx.fillRect(14, 10, 228, 1);
      ctx.fillRect(14, 21, 228, 1);
      MT.drawTextCentered(ctx, 'HUDDERSFIELD TOWN AFC 1926', 128, 13, P.YELLOW, 1, P.BLACK);

      // Big 8-bit Pixel Title Logo
      MT.drawTextCentered(ctx, 'MANIC', 128, 28, P.CYAN, 3, P.BLUE);
      MT.drawTextCentered(ctx, 'TERRIER', 128, 52, P.WHITE, 3, P.BLUE);

      // Subtitle
      MT.drawTextCentered(ctx, 'ANTIGRAVITY 8-BIT PLATFORMER', 128, 76, P.MAGENTA, 1);

      // Animated Mini Diorama Strip (Terry bouncing in Zero-G + Trophy + Flying Pie!)
      const boxY = 88;
      ctx.fillStyle = '#070D22';
      ctx.fillRect(16, boxY, 224, 34);
      ctx.strokeStyle = P.BLUE;
      ctx.strokeRect(16.5, boxY + 0.5, 223, 33);

      // Mini Zero-G beam in diorama
      ctx.fillStyle = 'rgba(0, 255, 255, 0.14)';
      ctx.fillRect(102, boxY + 1, 52, 32);

      // Terry floating & running across diorama
      const terryX = 28 + ((this.animTick * 34) % 192);
      const inBeam = terryX > 96 && terryX < 148;
      const terryY = inBeam
        ? boxY + 8 + Math.sin(this.animTick * 6) * 5
        : boxY + 16;
      const tSet = inBeam ? MT.sprites.terry.jump.right : MT.sprites.terry.walk.right;
      const tFrame = Math.floor(this.animTick * 8) % tSet.length;
      ctx.drawImage(tSet[tFrame], Math.round(terryX), Math.round(terryY));

      // Flying Pie & Collectibles in diorama
      const fIdx = Math.floor(this.animTick * 6) % 2;
      ctx.drawImage(MT.sprites.items.football[fIdx], 66, boxY + 18);
      ctx.drawImage(MT.sprites.items.trophy[fIdx], 123, boxY + 6);
      ctx.drawImage(MT.sprites.items.star[fIdx], 178, boxY + 18);
      const pieX = 216 - ((this.animTick * 28) % 192);
      ctx.drawImage(MT.sprites.pie[fIdx], Math.round(pieX), boxY + 5);

      // Retro Mechanics / Legend Panel
      MT.drawTextCentered(ctx, 'COLLECT FOOTBALLS, STARS & 1926 TROPHIES', 128, 128, P.YELLOW, 1);
      MT.drawTextCentered(ctx, 'RIDE ZERO-G FLOODLIGHTS & WIND UPDRAFTS', 128, 139, P.CYAN, 1);
      MT.drawTextCentered(ctx, 'HIT GRAVITY SWITCHES TO RUN ON CEILINGS!', 128, 150, P.MAGENTA, 1);

      // Flashing Start Prompt
      if (Math.floor(this.animTick * 3.2) % 2 === 0) {
        MT.drawTextCentered(ctx, 'PRESS SPACE / ENTER TO KICK OFF', 128, 166, P.WHITE, 1, P.BLUE);
      }

      // Direct Cavern Select hint
      MT.drawTextCentered(ctx, '[1] COWSHED  [2] CASTLE HILL  [3] VAULT', 128, 180, P.GREEN, 1);

      // High score footer
      MT.drawTextCentered(ctx, 'HIGH SCORE: ' + String(this.highScore).padStart(6, '0') + '  *  UP THE TOWN!', 128, 193, P.YELLOW, 1);
    }

    // =========================================================================
    // CHAMPIONS VICTORY SCREEN (After Clearing All 3 Caverns)
    // =========================================================================
    _renderVictoryScreen(ctx) {
      for (let i = 0; i < this.particles.length; i++) {
        const pt = this.particles[i];
        ctx.fillStyle = pt.color;
        ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
      }

      ctx.fillStyle = P.BLUE;
      ctx.fillRect(0, 8, MT.SCREEN_W, 14);
      MT.drawTextCentered(ctx, 'FULL TIME - THRICE CHAMPIONS!', 128, 12, P.YELLOW, 1, P.BLACK);

      MT.drawTextCentered(ctx, 'HTAFC VICTORY!', 128, 32, P.CYAN, 2, P.BLUE);

      // Terry celebrating with 3 Championship Stars & 1926 Trophy!
      const fIdx = Math.floor(this.animTick * 6) % 2;
      const hop = Math.round(Math.abs(Math.sin(this.animTick * 6)) * 6);
      ctx.drawImage(MT.sprites.terry.jump.right[0], 120, 62 - hop);
      ctx.drawImage(MT.sprites.items.trophy[fIdx], 123, 46 - hop);
      ctx.drawImage(MT.sprites.items.star[fIdx], 88, 56);
      ctx.drawImage(MT.sprites.items.star[fIdx], 158, 56);
      ctx.drawImage(MT.sprites.items.football[fIdx], 64, 68);
      ctx.drawImage(MT.sprites.items.football[fIdx], 182, 68);

      MT.drawTextCentered(ctx, 'ALL 3 CAVERNS CONQUERED!', 128, 92, P.WHITE, 1);
      MT.drawTextCentered(ctx, 'SMILE AWHILE, TERRIERS!', 128, 105, P.YELLOW, 1);

      MT.drawTextCentered(ctx, 'FINAL SCORE: ' + String(this.score).padStart(6, '0'), 128, 126, P.CYAN, 1);
      MT.drawTextCentered(ctx, 'HIGH SCORE:  ' + String(this.highScore).padStart(6, '0'), 128, 138, P.MAGENTA, 1);

      if (Math.floor(this.animTick * 3) % 2 === 0) {
        MT.drawTextCentered(ctx, 'PRESS SPACE FOR EXTRA TIME LOOP', 128, 162, P.GREEN, 1);
      }
      MT.drawTextCentered(ctx, 'PRESS R FOR NEW MATCH', 128, 178, P.WHITE, 1);
    }

    _renderOverlayBox(ctx, heading, lines, accentColor) {
      const boxW = 238;
      const boxH = 30 + lines.length * 12;
      const bx = Math.floor((MT.SCREEN_W - boxW) / 2);
      const by = Math.floor((MT.PLAY_H - boxH) / 2);

      ctx.fillStyle = P.BLACK;
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeStyle = accentColor || P.CYAN;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 1, by + 1, boxW - 2, boxH - 2);
      ctx.lineWidth = 1;

      ctx.fillStyle = P.BLUE;
      ctx.fillRect(bx + 3, by + 3, boxW - 6, 13);
      MT.drawTextCentered(ctx, heading, MT.SCREEN_W / 2, by + 6, P.YELLOW, 1, P.BLACK);

      for (let i = 0; i < lines.length; i++) {
        if (!lines[i]) continue;
        const col = i === lines.length - 1 ? P.CYAN : P.WHITE;
        MT.drawTextCentered(ctx, lines[i], MT.SCREEN_W / 2, by + 22 + i * 12, col, 1);
      }
    }
  }

  // Bootstrap reliably whether DOMContentLoaded already fired or not
  function bootManicTerrier() {
    if (MT.game) return;
    const canvas = document.getElementById('game-canvas');
    const bezel = document.getElementById('screen-bezel');
    if (canvas) {
      MT.game = new ManicTerrierGame(canvas, bezel);
      try {
        canvas.focus({ preventScroll: true });
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootManicTerrier);
  } else {
    bootManicTerrier();
  }
})(window);
