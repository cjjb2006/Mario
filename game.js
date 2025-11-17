const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const menu = document.getElementById("menu");
const startButton = document.getElementById("startButton");

const GRAVITY = 0.6;
const FRICTION = 0.8;
const AIR_FRICTION = 0.94;
const STOP_THRESHOLD = 0.05;
const JUMP_FORCE = -12;
const TILE_SIZE = 60;
const BASE_FRAME_TIME = 1000 / 60;

function loadSprite(src) {
  const img = new Image();
  img.src = src;
  return img;
}

const sprites = {
  player: loadSprite("assets/player.png"),
  enemy: loadSprite("assets/enemy.png"),
  brick: loadSprite("assets/brick.png"),
  ground: loadSprite("assets/ground.png"),
  coin: loadSprite("assets/coin.png"),
  flag: loadSprite("assets/flag.png"),
};

const player = {
  x: 120,
  y: 0,
  width: 32,
  height: 48,
  velX: 0,
  velY: 0,
  speed: 0.8,
  maxSpeed: 6,
  grounded: false,
  color: "#f9d648",
  facing: 1,
  state: "idle",
  prevState: "idle",
  frameIndex: 0,
  frameTimer: 0,
};

const animations = {
  idle: {
    duration: 450,
    frames: [
      { arm: 2, leg: 0, eye: 0 },
      { arm: -2, leg: 1.5, eye: -1 },
    ],
  },
  run: {
    duration: 90,
    frames: [
      { arm: -8, leg: 8, eye: 0 },
      { arm: 6, leg: -6, eye: 0 },
      { arm: -6, leg: 6, eye: 0 },
      { arm: 8, leg: -8, eye: 0 },
    ],
  },
  jump: {
    duration: 999,
    frames: [{ arm: -4, leg: -10, eye: -2 }],
  },
  fall: {
    duration: 999,
    frames: [{ arm: 6, leg: 12, eye: 2 }],
  },
};

const keys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  Space: false,
};

const tileMap = [
  "...........C............................................................",
  "...............E............C...........................................",
  ".............B......C...................................................",
  "....C.......BBB.....................B...E.........C.....................",
  ".........................C..BB.....BBB..................................",
  ".....BB....C.............BBBB.....E...........C..BB.....................",
  "........C......BB....................BB.........................E...C...",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
];

const tileLegend = {
  G: { type: "ground", color: "#2d6b2f" },
  B: { type: "brick", color: "#b4532a" },
};

const coinLegend = {
  C: { value: 10, radius: 14 },
};

const enemyLegend = {
  E: {
    speed: 1.2,
    patrolDistance: TILE_SIZE * 2.5,
    width: 36,
    height: 36,
    value: 50,
  },
};

let score = 0;
let coinsCollected = 0;
let totalCoins = 0;
let gameState = "menu";
let winMessageAlpha = 0;

const level = {
  width: tileMap[0].length * TILE_SIZE,
  platforms: [],
  obstacles: [],
  tiles: [],
  coins: [],
  enemies: [],
  flag: null,
};

function createLevelFromMap() {
  const mapHeight = tileMap.length * TILE_SIZE;
  const baseY = canvas.height - mapHeight;

  tileMap.forEach((row, rowIndex) => {
    row.split("").forEach((cell, colIndex) => {
      if (coinLegend[cell]) {
        const coin = {
          x: colIndex * TILE_SIZE + TILE_SIZE / 2,
          y: baseY + rowIndex * TILE_SIZE + TILE_SIZE / 2,
          radius: coinLegend[cell].radius,
          value: coinLegend[cell].value,
          collected: false,
        };
        level.coins.push(coin);
        totalCoins += 1;
        return;
      }

      if (enemyLegend[cell]) {
        const config = enemyLegend[cell];
        const spawnX = colIndex * TILE_SIZE + TILE_SIZE / 2;
        const spawnY = baseY + rowIndex * TILE_SIZE;
        const enemy = {
          x: spawnX - config.width / 2,
          y: spawnY - config.height,
          width: config.width,
          height: config.height,
          speed: config.speed,
          direction: Math.random() > 0.5 ? 1 : -1,
          minX: spawnX - config.patrolDistance / 2,
          maxX: spawnX + config.patrolDistance / 2,
          alive: true,
          value: config.value,
          wobble: Math.random() * Math.PI * 2,
        };
        level.enemies.push(enemy);
        return;
      }

      const tileInfo = tileLegend[cell];
      if (!tileInfo) return;

      const tile = {
        type: tileInfo.type,
        color: tileInfo.color,
        x: colIndex * TILE_SIZE,
        y: baseY + rowIndex * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
      };

      level.tiles.push(tile);
      level.platforms.push(tile);
    });
  });
}

createLevelFromMap();
positionPlayerAtStart();
placeFlag();

function positionPlayerAtStart() {
  const surfaceY = findSurfaceY(player.x, player.width);
  player.y = surfaceY - player.height;
}

function findSurfaceY(x, width) {
  let surface = null;

  level.tiles.forEach((tile) => {
    const overlaps =
      x + width > tile.x &&
      x < tile.x + tile.width;
    if (!overlaps) return;

    if (surface === null || tile.y < surface) {
      surface = tile.y;
    }
  });

  if (surface === null) {
    return canvas.height - TILE_SIZE;
  }

  return surface;
}

function placeFlag() {
  const baseX = level.width - TILE_SIZE * 2;
  const surfaceY = findSurfaceY(baseX, TILE_SIZE);
  level.flag = {
    x: baseX + TILE_SIZE / 2 - 6,
    y: surfaceY - TILE_SIZE * 4,
    width: 12,
    height: TILE_SIZE * 4,
    flagWidth: 36,
    flagHeight: 22,
    reached: false,
  };
}

function handleInput(delta) {
  const timeScale = delta / BASE_FRAME_TIME || 0;
  const inputAxis = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  const friction = player.grounded ? FRICTION : AIR_FRICTION;

  if (gameState !== "playing") return;

  player.velX *= Math.pow(friction, timeScale);

  if (inputAxis !== 0) {
    player.velX += inputAxis * player.speed * timeScale;
    player.facing = inputAxis;
  }

  if (Math.abs(player.velX) < STOP_THRESHOLD) {
    player.velX = 0;
  }

  if ((keys.ArrowUp || keys.Space) && player.grounded) {
    player.velY = JUMP_FORCE;
    player.grounded = false;
  }
}

function updatePlayerState(delta) {
  const absVelX = Math.abs(player.velX);
  if (!player.grounded) {
    player.state = player.velY < 0 ? "jump" : "fall";
  } else if (absVelX > 0.8) {
    player.state = "run";
  } else {
    player.state = "idle";
  }

  if (player.state !== player.prevState) {
    player.frameIndex = 0;
    player.frameTimer = 0;
    player.prevState = player.state;
  }

  const animation = animations[player.state] || animations.idle;
  player.frameTimer += delta;
  if (player.frameTimer >= animation.duration) {
    player.frameTimer = 0;
    player.frameIndex = (player.frameIndex + 1) % animation.frames.length;
  }

  if (player.state === "jump" || player.state === "fall") {
    player.frameIndex = 0;
    player.frameTimer = 0;
  }
}

function applyPhysics(delta) {
  const timeScale = delta / BASE_FRAME_TIME || 0;
  player.velY += GRAVITY * timeScale;
  player.velY = Math.min(player.velY, 20);

  const clampedVelX = Math.max(Math.min(player.velX, player.maxSpeed), -player.maxSpeed);
  player.x += clampedVelX * timeScale;
  player.y += player.velY * timeScale;

  if (player.x < 0) player.x = 0;
  if (player.x + player.width > level.width) {
    player.x = level.width - player.width;
  }
}

function rectIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function resolveCollisions() {
  player.grounded = false;

  const solids = [...level.platforms, ...level.obstacles];

  solids.forEach((solid) => {
    const solidRect = {
      x: solid.x,
      y: solid.y,
      width: solid.width,
      height: solid.height,
    };

    const playerRect = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
    };

    if (!rectIntersect(playerRect, solidRect)) return;

    const overlapX =
      player.x + player.width / 2 < solid.x + solid.width / 2
        ? player.x + player.width - solid.x
        : solid.x + solid.width - player.x;

    const overlapY =
      player.y + player.height / 2 < solid.y + solid.height / 2
        ? player.y + player.height - solid.y
        : solid.y + solid.height - player.y;

    if (overlapX < overlapY) {
      if (player.x < solid.x) {
        player.x -= overlapX;
      } else {
        player.x += overlapX;
      }
      player.velX = 0;
    } else {
      if (player.y < solid.y) {
        player.y -= overlapY;
        player.velY = 0;
        player.grounded = true;
      } else {
        player.y += overlapY;
        player.velY = 0;
      }
    }
  });

  if (player.y + player.height > canvas.height) {
    player.y = canvas.height - player.height;
    player.velY = 0;
    player.grounded = true;
  }
}

function checkCoinCollection() {
  if (gameState !== "playing") return;
  const playerRect = {
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
  };

  level.coins.forEach((coin) => {
    if (coin.collected) return;
    const coinRect = {
      x: coin.x - coin.radius,
      y: coin.y - coin.radius,
      width: coin.radius * 2,
      height: coin.radius * 2,
    };

    if (rectIntersect(playerRect, coinRect)) {
      coin.collected = true;
      score += coin.value;
      coinsCollected += 1;
    }
  });
}

function updateEnemies(delta) {
  if (gameState !== "playing") return;
  const timeScale = delta / BASE_FRAME_TIME || 0;
  level.enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    enemy.x += enemy.speed * enemy.direction * timeScale;

    if (enemy.x <= enemy.minX) {
      enemy.x = enemy.minX;
      enemy.direction = 1;
    } else if (enemy.x + enemy.width >= enemy.maxX) {
      enemy.x = enemy.maxX - enemy.width;
      enemy.direction = -1;
    }

    enemy.wobble += delta * 0.005;
  });
}

function handleEnemyCollisions() {
  if (gameState !== "playing") return;
  const playerRect = {
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
  };

  level.enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    const enemyRect = {
      x: enemy.x,
      y: enemy.y,
      width: enemy.width,
      height: enemy.height,
    };

    if (!rectIntersect(playerRect, enemyRect)) return;

    const stompThreshold = enemy.y + enemy.height * 0.3;
    const isStomp = player.velY > 0 && player.y + player.height <= stompThreshold;

    if (isStomp) {
      enemy.alive = false;
      player.velY = JUMP_FORCE * 0.6;
      score += enemy.value;
    } else {
      if (player.x + player.width / 2 < enemy.x + enemy.width / 2) {
        player.x = enemy.x - player.width;
      } else {
        player.x = enemy.x + enemy.width;
      }
      player.velX = -player.facing * 4;
      player.velY = JUMP_FORCE * 0.5;
    }
  });
}

function checkFlagReached() {
  if (gameState !== "playing" || !level.flag) return;

  const playerRect = {
    x: player.x,
    y: player.y,
    width: player.width,
    height: player.height,
  };

  const flagRect = {
    x: level.flag.x - 8,
    y: level.flag.y,
    width: level.flag.flagWidth + 16,
    height: level.flag.height,
  };

  if (rectIntersect(playerRect, flagRect)) {
    gameState = "completed";
    level.flag.reached = true;
    player.velX = 0;
    player.velY = 0;
  }
}

function drawBackground(cameraX) {
  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, "#8ed6ff");
  skyGradient.addColorStop(1, "#d1f2ff");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  for (let i = 0; i < 5; i++) {
    const x = ((i * 500 - cameraX * 0.3) % (canvas.width + 200)) - 200;
    ctx.fillRect(x, 80 + i * 20, 180, 40);
  }

  ctx.fillStyle = "#48753b";
  ctx.fillRect(0, canvas.height - 80, canvas.width, 80);
}

function drawTiles(cameraX) {
  level.tiles.forEach((tile) => {
    const screenX = tile.x - cameraX;
    if (screenX + tile.width < -50 || screenX > canvas.width + 50) return;

    const image =
      tile.type === "ground" ? sprites.ground : tile.type === "brick" ? sprites.brick : null;

    if (image && image.complete) {
      ctx.drawImage(image, screenX, tile.y, tile.width, tile.height);
    } else {
      ctx.fillStyle = tile.color;
      ctx.fillRect(screenX, tile.y, tile.width, tile.height);
    }
  });
}

function drawCoins(cameraX) {
  level.coins.forEach((coin) => {
    if (coin.collected) return;
    const screenX = coin.x - cameraX;
    if (screenX + coin.radius < -50 || screenX - coin.radius > canvas.width + 50)
      return;

    if (sprites.coin && sprites.coin.complete) {
      const size = coin.radius * 2;
      ctx.drawImage(sprites.coin, screenX - coin.radius, coin.y - coin.radius, size, size);
    } else {
      ctx.fillStyle = "#f2b705";
      ctx.beginPath();
      ctx.arc(screenX, coin.y, coin.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function drawFlag(cameraX) {
  if (!level.flag) return;
  const poleX = level.flag.x - cameraX;

  ctx.save();
  if (sprites.flag && sprites.flag.complete) {
    ctx.drawImage(
      sprites.flag,
      poleX - level.flag.width,
      level.flag.y,
      level.flag.flagWidth,
      level.flag.height
    );
  } else {
    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(poleX, level.flag.y, level.flag.width, level.flag.height);
  }
  ctx.restore();
}

function drawEnemies(cameraX) {
  level.enemies.forEach((enemy) => {
    if (!enemy.alive) return;
    const screenX = enemy.x - cameraX;
    if (screenX + enemy.width < -50 || screenX > canvas.width + 50) return;

    ctx.save();
    const bob = Math.sin(enemy.wobble) * 2;
    if (sprites.enemy && sprites.enemy.complete) {
      ctx.translate(
        screenX + enemy.width / 2,
        enemy.y + enemy.height / 2 + bob
      );
      ctx.scale(enemy.direction, 1);
      ctx.drawImage(
        sprites.enemy,
        -enemy.width / 2,
        -enemy.height / 2,
        enemy.width,
        enemy.height
      );
    } else {
      ctx.translate(screenX, enemy.y + bob);
      ctx.fillStyle = "#7b2cbf";
      ctx.fillRect(0, 0, enemy.width, enemy.height);
    }
    ctx.restore();
  });
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.fillRect(16, 16, 230, 70);

  const iconSize = 28;
  if (sprites.coin && sprites.coin.complete) {
    ctx.drawImage(sprites.coin, 26, 30, iconSize, iconSize);
  } else {
    ctx.fillStyle = "#f2b705";
    ctx.beginPath();
    ctx.arc(40, 44, iconSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#ffd166";
  ctx.font = "18px 'Courier New', monospace";
  ctx.fillText(
    `金币: ${coinsCollected}/${totalCoins || level.coins.length}`,
    64,
    44
  );
  ctx.fillText(`分数: ${score}`, 64, 68);
  ctx.restore();
}

function drawWinOverlay() {
  if (gameState !== "completed") return;

  ctx.save();
  const overlayAlpha = Math.min(0.7, winMessageAlpha * 0.7);
  ctx.fillStyle = `rgba(12, 12, 12, ${overlayAlpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, winMessageAlpha)})`;
  ctx.font = "48px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillText("恭喜通关!", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "20px 'Courier New', monospace";
  ctx.fillText("刷新页面可重新开始", canvas.width / 2, canvas.height / 2 + 30);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawPlayer(cameraX) {
  const screenX = player.x - cameraX;
  ctx.save();
  ctx.translate(screenX + player.width / 2, player.y + player.height / 2);
  ctx.scale(player.facing, 1);

  if (sprites.player && sprites.player.complete) {
    ctx.drawImage(
      sprites.player,
      -player.width / 2,
      -player.height / 2,
      player.width,
      player.height
    );
  } else {
    ctx.fillStyle = player.color;
    ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
  }

  ctx.restore();
}

let lastTime = 0;

function gameLoop(timestamp) {
  let delta = timestamp - lastTime;
  lastTime = timestamp;
  // 最长一帧100ms，防止切换桌面后角色飞出
  if (delta > 100) delta = 100;

  if (gameState === "playing") {
    winMessageAlpha = 0;
    handleInput(delta);
    applyPhysics(delta);
    resolveCollisions();
    updatePlayerState(delta);
    checkCoinCollection();
    updateEnemies(delta);
    handleEnemyCollisions();
    checkFlagReached();
  } else if (gameState === "completed") {
    winMessageAlpha = Math.min(winMessageAlpha + delta * 0.002, 1);
  }

  const cameraX = Math.max(
    0,
    Math.min(player.x - canvas.width / 2, level.width - canvas.width)
  );

  drawBackground(cameraX);
  drawTiles(cameraX);
  drawFlag(cameraX);
  drawCoins(cameraX);
  drawEnemies(cameraX);
  drawPlayer(cameraX);
  drawHud();
  drawWinOverlay();

  requestAnimationFrame(gameLoop);
}

function bindControls() {
  startButton.addEventListener("click", () => {
    if (gameState === "menu") {
      gameState = "playing";
      menu.style.display = "none";
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.code in keys) {
      keys[event.code] = true;
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.code in keys) {
      keys[event.code] = false;
      event.preventDefault();
    }
  });
}

bindControls();
requestAnimationFrame(gameLoop);

