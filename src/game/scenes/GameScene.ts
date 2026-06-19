import * as THREE from "three";
import type { App, GameSceneController } from "../App";
import {
  BALANCE,
  OBSTACLE_COUNTS_BY_MAP,
  ROUND_DURATION_BY_MAP,
  TEST_BOMB_COUNTS,
} from "../config/balance";
import { Bomb } from "../entities/Bomb";
import { Coin } from "../entities/Coin";
import { Debris } from "../entities/Debris";
import { Explosions } from "../entities/Explosions";
import { FallingLog } from "../entities/FallingLog";
import { GrassClippings } from "../entities/GrassClippings";
import { GrassField } from "../entities/GrassField";
import { Obstacle } from "../entities/Obstacle";
import { Player, PLAYER_COLLISION_RADIUS } from "../entities/Player";
import {
  advanceChargeAttack,
  getSurvivingHitIds,
  type ChargeAttackState,
  resolveAttack,
} from "../systems/AttackSystem";
import {
  bombsTriggeredBy,
  createBombState,
  grassInRadius,
  resolveChainDetonation,
  type BombState,
} from "../systems/BombSystem";
import {
  createObstacleState,
  OBSTACLE_BASE_RADIUS,
  resolveObstacleAttack,
  TREE_STUMP_BASE_RADIUS,
  type Circle,
  type ObstacleKind,
  type ObstacleState,
} from "../systems/ObstacleSystem";
import { cloneModel } from "../assets/models";
import type { RunScoreEvent } from "../systems/EconomySystem";
import { createGrassBatch, createGrassState, randomGrassPosition } from "../systems/GrassSystem";
import { InputSystem, mapScreenInputToWorldMovement } from "../systems/InputSystem";
import { applyRunResultToSave, loadSave, saveGame } from "../systems/SaveSystem";
import { getEconomyStats, getRuntimeStats, nextAffordableGoals, type RuntimeStats } from "../systems/SkillSystem";
import { summarizeRun } from "../systems/RunSummarySystem";
import { Hud } from "../ui/Hud";
import { VirtualJoystick } from "../ui/VirtualJoystick";
import type { GrassState } from "../types";

const ATTACK_FLASH_DURATION = 0.45;

export class GameScene implements GameSceneController {
  readonly scene = new THREE.Scene();
  private readonly input = new InputSystem();
  private readonly hud: Hud;
  private readonly joystick: VirtualJoystick;
  private readonly player = new Player();
  private grassField!: GrassField;
  private sun!: THREE.DirectionalLight;
  private readonly clippings = new GrassClippings();
  private readonly explosions = new Explosions();
  private readonly coins: Coin[] = [];
  private readonly bombs = new Map<string, Bomb>();
  private bombStates: BombState[] = [];
  private readonly pendingDetonations: { id: string; delayMs: number }[] = [];
  private readonly obstacles = new Map<string, Obstacle>();
  private obstacleStates: ObstacleState[] = [];
  private readonly fallingLogs: FallingLog[] = [];
  private readonly rockChips = new Debris(["#8a8a90", "#6f6f77", "#a6a6ac"], [0.09, 0.09, 0.09]);
  private readonly woodChips = new Debris(["#7a5230", "#5e3d1f", "#9b6b3a"], [0.13, 0.05, 0.05]);
  // Collision-circle debug overlay (toggled by a button); off by default.
  private readonly debugGroup = new THREE.Group();
  private readonly debugCircleGeo = new THREE.CircleGeometry(1, 28);
  private readonly debugObstacleMat = new THREE.MeshBasicMaterial({
    color: "#33e0ff",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly debugPlayerMat = new THREE.MeshBasicMaterial({
    color: "#ffd23f",
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly debugObstacleDiscs = new Map<string, THREE.Mesh>();
  private debugPlayerDisc!: THREE.Mesh;
  private debugButton!: HTMLButtonElement;
  private debugVisible = false;
  private readonly stats: RuntimeStats;
  private readonly attackChargeGroup = new THREE.Group();
  private readonly attackRing: THREE.Mesh;
  private elapsedMs = 0;
  private chargeState: ChargeAttackState;
  private attackFlash = 0;
  private spawnTimerMs = 0;
  private roundGold = 0;
  private initialGrassTotal = 0;
  private readonly scoreEvents: RunScoreEvent[] = [];
  private nextGrassId = 1;
  private ended = false;
  private save = loadSave();
  private readonly mapSize: number;
  private readonly roundDurationMs: number;
  private readonly cameraTarget = new THREE.Vector3(0, 0, 0);

  constructor(private readonly app: App) {
    // Assigned in the body (not a field initializer): `app` is a constructor
    // parameter property, which isn't available when field initializers run.
    this.mapSize = this.app.mapSizeMeters;
    this.stats = getRuntimeStats(this.save);
    // Round length depends on the chosen map; skill bonuses add on top.
    const skillRoundBonus = this.stats.roundDurationMs - BALANCE.roundDurationMs;
    this.roundDurationMs = (ROUND_DURATION_BY_MAP[this.mapSize] ?? BALANCE.roundDurationMs) + skillRoundBonus;
    this.hud = new Hud(this.app.uiRoot);
    this.joystick = new VirtualJoystick(this.app.uiRoot, (vector) => this.input.setJoystickVector(vector));
    this.chargeState = { elapsedMs: 0, durationMs: this.stats.attackChargeDurationMs };
    this.attackRing = this.createIndicator();

    this.scene.background = new THREE.Color("#617075");
    this.scene.fog = new THREE.Fog("#617075", 12, 24);
    this.app.setOrthoSize(window.innerWidth < 760 ? 7.8 : 9.4);

    this.addLights();
    this.addMap();
    this.scene.add(this.player.group);
    this.scene.add(this.attackChargeGroup);
    this.grassField = new GrassField();
    this.scene.add(this.grassField.group);
    this.scene.add(this.clippings.mesh);
    this.scene.add(this.explosions.group);
    this.scene.add(this.rockChips.mesh);
    this.scene.add(this.woodChips.mesh);
    this.spawnInitialGrass();
    this.spawnTestBombs();
    this.spawnObstacles();
    this.buildCollisionDebug();
    this.createDebugButton();
    this.updateInputMode();
    window.addEventListener("resize", this.updateInputMode);
  }

  update(deltaSeconds: number): void {
    this.updateCamera();
    this.player.update(deltaSeconds);
    this.updateGrass(deltaSeconds);
    this.updateCoins(deltaSeconds);
    this.clippings.update(deltaSeconds);
    this.explosions.update(deltaSeconds);
    this.rockChips.update(deltaSeconds);
    this.woodChips.update(deltaSeconds);
    this.updateFallingLogs(deltaSeconds);
    this.updateBombs(deltaSeconds);
    this.updateCollisionDebug();
    this.hud.update(deltaSeconds);

    if (!this.ended) {
      this.elapsedMs += deltaSeconds * 1000;
      if (this.stats.grassSpawnPerTick > 0) {
        this.spawnTimerMs += deltaSeconds * 1000;

        while (this.spawnTimerMs >= this.stats.grassSpawnIntervalMs) {
          this.spawnTimerMs -= this.stats.grassSpawnIntervalMs;
          this.spawnGrass(this.stats.grassSpawnPerTick);
        }
      }

      const movement = mapScreenInputToWorldMovement(this.input.getMovementVector());
      this.player.move(movement, this.stats.moveSpeed, deltaSeconds, this.mapSize, this.collisionBlockers());

      // A stunned player can't swing; the charge timer holds until they recover.
      if (!this.player.stunned) {
        const charge = advanceChargeAttack(this.chargeState, deltaSeconds * 1000);
        this.chargeState = charge.state;

        if (charge.ready) {
          this.performAttack();
        }
      }

      if (this.elapsedMs >= this.roundDurationMs) {
        this.endRound();
      }
    }

    this.updateIndicator(deltaSeconds);

    this.hud.updateGame({
      timeMs: this.roundDurationMs - this.elapsedMs,
      roundGold: this.roundGold,
      totalGold: this.save.gold + this.roundGold,
      damage: this.stats.attackDamage,
      attackIntervalMs: this.stats.attackChargeDurationMs,
      range: this.stats.attackRangeMeters,
    });
  }

  dispose(): void {
    window.removeEventListener("resize", this.updateInputMode);
    this.input.dispose();
    this.joystick.dispose();
    this.hud.dispose();
    this.grassField.dispose();
    this.clippings.dispose();
    this.explosions.dispose();
    this.rockChips.dispose();
    this.woodChips.dispose();
    this.coins.forEach((coin) => coin.dispose());
    this.bombs.forEach((bomb) => bomb.dispose());
    this.bombs.clear();
    this.obstacles.forEach((obstacle) => obstacle.dispose());
    this.obstacles.clear();
    this.fallingLogs.forEach((log) => log.dispose());
    this.debugButton.remove();
    this.debugCircleGeo.dispose();
    this.debugObstacleMat.dispose();
    this.debugPlayerMat.dispose();
    this.attackRing.geometry.dispose();
    (this.attackRing.material as THREE.Material).dispose();
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight("#f4f9e8", "#3d4a52", 1.55));
    const sun = new THREE.DirectionalLight("#ffe7b0", 2.15);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 40;
    // Shadow frustum covers the visible area and follows the player (see
    // updateCamera) so shadows work on a large map and chunks cull in the
    // shadow pass too.
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  private addMap(): void {
    // Blender ground is authored at 10x10; scale it to the current map size.
    const ground = cloneModel("ground");
    const groundScale = this.mapSize / 10;
    ground.scale.set(groundScale, 1, groundScale);
    this.scene.add(ground);

    const half = this.mapSize / 2;
    const points = [
      new THREE.Vector3(-half, 0.04, -half),
      new THREE.Vector3(half, 0.04, -half),
      new THREE.Vector3(half, 0.04, half),
      new THREE.Vector3(-half, 0.04, half),
      new THREE.Vector3(-half, 0.04, -half),
    ];
    const border = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: "#f0d786", linewidth: 2 }),
    );
    this.scene.add(border);
  }

  private createIndicator(): THREE.Mesh {
    // White outline ring matching the circular attack range. depthTest stays on
    // so the character occludes the portion of the ring drawn behind it.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 64),
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2; // lay flat on the ground
    ring.position.y = 0.08;
    ring.renderOrder = 11;
    this.attackChargeGroup.add(ring);
    return ring;
  }

  private spawnInitialGrass(): void {
    // Scale the base count (tuned for 10x10) by map area so density is constant.
    const areaScale = (this.mapSize / BALANCE.mapSizeMeters) ** 2;
    const count = Math.round(this.stats.initialGrassCount * areaScale);
    this.initialGrassTotal = count;
    const batch = createGrassBatch(count, this.nextGrassId, this.mapSize);
    this.nextGrassId += batch.length;
    for (const state of batch) {
      this.addGrassState(state);
    }
  }

  private spawnGrass(count: number): void {
    for (let index = 0; index < count; index += 1) {
      this.addGrassState(
        createGrassState(`grass-${this.nextGrassId}`, randomGrassPosition(this.mapSize, this.player.position)),
      );
      this.nextGrassId += 1;
    }
  }

  private addGrassState(state: GrassState): void {
    this.grassField.add(state);
  }

  private spawnTestBombs(): void {
    // Scatter a fixed batch of test bombs for the chosen map (none on 10x10,
    // a handful on 30x30). Kept away from the player's start so a run doesn't
    // begin mid-explosion.
    const count = (TEST_BOMB_COUNTS[this.mapSize] ?? 0) + (this.mapSize === 10 ? this.stats.bombCount10m : 0);
    for (let index = 0; index < count; index += 1) {
      const position = randomGrassPosition(this.mapSize, { x: 0, z: 0 });
      const id = `bomb-${index + 1}`;
      this.bombStates.push(createBombState(id, position));
      const bomb = new Bomb(position);
      this.bombs.set(id, bomb);
      this.scene.add(bomb.group);
    }
  }

  private spawnObstacles(): void {
    // Scatter rocks and trees randomly across the map (away from the start).
    const counts = OBSTACLE_COUNTS_BY_MAP[this.mapSize] ?? { rocks: 0, trees: 0 };
    const spawn = (kind: ObstacleKind, count: number): void => {
      for (let index = 0; index < count; index += 1) {
        const position = randomGrassPosition(this.mapSize, { x: 0, z: 0 });
        const id = `${kind}-${index + 1}`;
        // One scale drives both the visual model and the collision radius.
        const scale = 0.85 + Math.random() * 0.3;
        const radius = OBSTACLE_BASE_RADIUS[kind] * scale;
        this.obstacleStates.push(createObstacleState(id, kind, position, BALANCE.obstacleHp, radius));
        const obstacle = new Obstacle(kind, position, scale);
        this.obstacles.set(id, obstacle);
        this.scene.add(obstacle.group);
      }
    };
    spawn("rock", counts.rocks);
    spawn("tree", counts.trees);
  }

  /**
   * Collision circles: intact obstacles always block; once broken, a rock
   * vanishes (passable) while a tree keeps blocking at its stump radius.
   */
  private collisionBlockers(): Circle[] {
    const blockers: Circle[] = [];
    for (const obstacle of this.obstacleStates) {
      const stumpPassable = obstacle.kind === "tree" && obstacle.destroyed && this.stats.stumpNoCollision;
      const blocks = !stumpPassable && (obstacle.kind === "tree" || !obstacle.destroyed);
      if (blocks) {
        blockers.push({
          x: obstacle.position.x,
          z: obstacle.position.z,
          radius: obstacle.radius,
        });
      }
    }
    return blockers;
  }

  private buildCollisionDebug(): void {
    // A flat disc per obstacle collision circle (cyan) + one for the player
    // (yellow) that follows them. Hidden until the debug button is toggled.
    for (const state of this.obstacleStates) {
      const disc = new THREE.Mesh(this.debugCircleGeo, this.debugObstacleMat);
      disc.rotation.x = -Math.PI / 2;
      disc.scale.setScalar(state.radius);
      disc.position.set(state.position.x, 0.06, state.position.z);
      disc.renderOrder = 13;
      this.debugGroup.add(disc);
      this.debugObstacleDiscs.set(state.id, disc);
    }

    this.debugPlayerDisc = new THREE.Mesh(this.debugCircleGeo, this.debugPlayerMat);
    this.debugPlayerDisc.rotation.x = -Math.PI / 2;
    this.debugPlayerDisc.scale.setScalar(PLAYER_COLLISION_RADIUS);
    this.debugPlayerDisc.renderOrder = 13;
    this.debugGroup.add(this.debugPlayerDisc);

    this.debugGroup.visible = false;
    this.scene.add(this.debugGroup);
  }

  private createDebugButton(): void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "debug-toggle";
    button.textContent = "충돌 박스";
    // Don't let the tap also spawn the virtual joystick underneath.
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", () => {
      this.debugVisible = !this.debugVisible;
      this.debugGroup.visible = this.debugVisible;
      button.classList.toggle("on", this.debugVisible);
    });
    this.app.uiRoot.appendChild(button);
    this.debugButton = button;
  }

  private updateCollisionDebug(): void {
    if (!this.debugVisible) {
      return;
    }
    this.debugPlayerDisc.position.set(this.player.position.x, 0.06, this.player.position.z);
    for (const state of this.obstacleStates) {
      const disc = this.debugObstacleDiscs.get(state.id);
      if (disc) {
        // Trees keep blocking (stump) so their circle stays, resized to the
        // stump; a broken rock stops blocking so its circle disappears.
        disc.visible = state.kind === "tree" || !state.destroyed;
        disc.scale.setScalar(state.radius);
      }
    }
  }

  private updateBombs(deltaSeconds: number): void {
    for (const bomb of this.bombs.values()) {
      bomb.update(deltaSeconds);
    }

    if (this.ended) {
      return;
    }

    // Fire chain-scheduled detonations as their staggered delays elapse.
    const deltaMs = deltaSeconds * 1000;
    for (let index = this.pendingDetonations.length - 1; index >= 0; index -= 1) {
      const pending = this.pendingDetonations[index];
      pending.delayMs -= deltaMs;
      if (pending.delayMs <= 0) {
        this.pendingDetonations.splice(index, 1);
        this.fireBomb(pending.id);
      }
    }

    // Walking into a live bomb starts a new chain.
    const triggered = bombsTriggeredBy(this.bombStates, this.player.position, BALANCE.bombTriggerRadiusMeters);
    if (triggered.length > 0) {
      this.triggerChain(triggered[0]);
    }
  }

  private triggerChain(triggerId: string): void {
    const order = resolveChainDetonation(this.bombStates, triggerId, this.stats.bombChainRadiusMeters);
    if (order.length === 0) {
      return;
    }
    this.recordScoreEvent({ kind: "bombChain", chainLength: order.length, firstBomb: this.scoreEvents.every((event) => event.kind !== "bombChain") });

    // Mark the whole chain detonated up front so nothing retriggers; the visual
    // explosions are staggered for a cascading "chain" feel.
    const chained = new Set(order);
    this.bombStates = this.bombStates.map((bomb) =>
      chained.has(bomb.id) ? { ...bomb, detonated: true } : bomb,
    );
    order.forEach((id, index) => {
      this.pendingDetonations.push({ id, delayMs: index * BALANCE.bombChainDelayMs });
    });
  }

  private fireBomb(id: string): void {
    const state = this.bombStates.find((bomb) => bomb.id === id);
    if (!state) {
      return;
    }
    const center = state.position;
    const radius = this.stats.bombBlastRadiusMeters;

    this.explosions.emit(center.x, center.z, radius);

    const bomb = this.bombs.get(id);
    if (bomb) {
      this.scene.remove(bomb.group);
      bomb.dispose();
      this.bombs.delete(id);
    }

    // Mow every grass clump inside the blast. Gold is granted for all of them,
    // but coin/clipping VFX are capped so a huge blast can't spike the frame.
    const grassStates = this.grassField.getStates();
    const positionById = new Map(grassStates.map((grass) => [grass.id, grass.position]));
    const hitIds = grassInRadius(grassStates, center, radius);

    let coinBudget = BALANCE.bombMaxCoinsPerBlast;
    let clipBudget = BALANCE.bombMaxClippingsPerBlast;
    for (const grassId of hitIds) {
      const position = positionById.get(grassId);
      this.grassField.destroy(grassId);
      if (!position) {
        continue;
      }
      if (clipBudget > 0) {
        this.clippings.emit(position.x, position.z);
        clipBudget -= 1;
      }
      if (coinBudget > 0) {
        const coin = new Coin(position, center);
        this.coins.push(coin);
        this.scene.add(coin.group);
        coinBudget -= 1;
      }
    }

    if (hitIds.length > 0) {
      this.recordScoreEvent({ kind: "grassCut", count: hitIds.length });
    }
  }

  private performAttack(): void {
    this.attackFlash = 1; // flash the range ring on every strike
    const grassStates = this.grassField.getStates();
    const result = resolveAttack({
      origin: this.player.position,
      direction: this.player.direction,
      range: this.stats.attackRangeMeters,
      arcDegrees: this.stats.attackArcDegrees,
      damage: this.stats.attackDamage,
      grass: grassStates,
    });
    const positionById = new Map(grassStates.map((state) => [state.id, state.position]));
    const resultById = new Map(result.grass.map((state) => [state.id, state]));

    // (test) damage text disabled

    for (const id of result.destroyedIds) {
      const position = positionById.get(id);
      if (!position) {
        continue;
      }
      const coin = new Coin(position, this.player.position);
      this.coins.push(coin);
      this.scene.add(coin.group);
      this.clippings.emit(position.x, position.z);
      this.grassField.destroy(id);
    }

    for (const id of getSurvivingHitIds(result)) {
      const state = resultById.get(id);
      if (state) {
        this.grassField.setHp(id, state.hp);
        const position = positionById.get(id);
        if (position) {
          this.clippings.emitHit(position.x, position.z);
        }
      }
    }

    if (result.hitIds.length > 0) {
      this.player.strike();
    }

    if (result.destroyedIds.length > 0) {
      this.recordScoreEvent({ kind: "grassCut", count: result.destroyedIds.length });
    }

    this.attackObstacles();
  }

  private attackObstacles(): void {
    // Same swing as grass, but all-or-nothing: only damage greater than an
    // obstacle's HP breaks it, and breaking one recoils the player into a stun.
    const result = resolveObstacleAttack({
      origin: this.player.position,
      direction: this.player.direction,
      range: this.stats.attackRangeMeters,
      arcDegrees: this.stats.attackArcDegrees,
      damage: this.stats.attackDamage,
      obstacleDamageBonus: this.stats.obstacleDamageBonus,
      obstacles: this.obstacleStates,
    });

    if (result.destroyedIds.length === 0 && result.blockedIds.length === 0) {
      return;
    }

    for (const id of result.destroyedIds) {
      const state = this.obstacleStates.find((obstacle) => obstacle.id === id);
      const obstacle = this.obstacles.get(id);
      if (!state || !obstacle) {
        continue;
      }
      state.destroyed = true;
      obstacle.break(); // rock vanishes; tree leaves a stump

      if (state.kind === "rock") {
        this.rockChips.emit(state.position.x, state.position.z);
        this.recordScoreEvent({ kind: "rockBroken", count: 1 });
      } else {
        // Bigger, denser wood chips at the cut, plus the upper trunk topples away.
        this.woodChips.emit(state.position.x, state.position.z, { count: 32, scale: 1.9 });
        const scale = state.radius / OBSTACLE_BASE_RADIUS.tree;
        const log = new FallingLog(state.position, scale);
        this.fallingLogs.push(log);
        this.scene.add(log.group);
        // The stump keeps blocking, but at the (smaller) stump footprint.
        state.radius = this.stats.stumpNoCollision ? 0 : TREE_STUMP_BASE_RADIUS * scale;
        this.recordScoreEvent({ kind: "treeBroken", count: 1 });
      }
    }

    this.player.strike();

    // A chop that failed to break anything recoils the player: shove away from
    // the obstacle(s) that resisted, flash red, and lock out actions.
    if (result.blockedIds.length > 0) {
      let awayX = 0;
      let awayZ = 0;
      for (const id of result.blockedIds) {
        const state = this.obstacleStates.find((obstacle) => obstacle.id === id);
        if (state) {
          awayX += this.player.position.x - state.position.x;
          awayZ += this.player.position.z - state.position.z;
        }
      }
      this.player.applyKnockback(awayX, awayZ, BALANCE.obstacleKnockbackSpeed);
      this.player.stun(BALANCE.obstacleStunSeconds * this.stats.obstacleStunMultiplier);
    }
  }

  private updateFallingLogs(deltaSeconds: number): void {
    for (let index = this.fallingLogs.length - 1; index >= 0; index -= 1) {
      const log = this.fallingLogs[index];
      if (log.update(deltaSeconds)) {
        this.scene.remove(log.group);
        log.dispose();
        this.fallingLogs.splice(index, 1);
      }
    }
  }

  private updateCoins(deltaSeconds: number): void {
    for (let index = this.coins.length - 1; index >= 0; index -= 1) {
      const coin = this.coins[index];

      if (coin.update(deltaSeconds)) {
        this.scene.remove(coin.group);
        coin.dispose();
        this.coins.splice(index, 1);
      }
    }
  }

  private updateGrass(deltaSeconds: number): void {
    this.grassField.update(deltaSeconds);
  }

  private updateIndicator(deltaSeconds: number): void {
    this.attackChargeGroup.position.set(this.player.position.x, 0, this.player.position.z);
    const range = this.stats.attackRangeMeters;
    this.attackRing.scale.set(range, range, 1);

    // Sit at 30% opacity, flash to 100% on a strike, then fade back.
    this.attackFlash = Math.max(0, this.attackFlash - deltaSeconds / ATTACK_FLASH_DURATION);
    (this.attackRing.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.7 * this.attackFlash;
  }

  private updateCamera(): void {
    this.cameraTarget.set(this.player.position.x, 0, this.player.position.z);
    const offset = new THREE.Vector3(5.8, 6.2, 5.8);
    this.app.camera.position.copy(this.cameraTarget).add(offset);
    this.app.camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z);

    // Sun + shadow frustum follow the player so shadows cover the view on a
    // large map (and the shadow pass only renders nearby chunks).
    this.sun.position.set(this.player.position.x + 4, 8, this.player.position.z + 5);
    this.sun.target.position.set(this.player.position.x, 0, this.player.position.z);
  }

  private worldToScreen(position: THREE.Vector3): { x: number; y: number } {
    const projected = position.clone().project(this.app.camera);

    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  private recordScoreEvent(event: RunScoreEvent): void {
    this.scoreEvents.push(event);
    this.roundGold = summarizeRun(this.scoreEvents, getEconomyStats(this.save), this.mapSize).gold;
  }

  private clearPercent(): number {
    if (this.initialGrassTotal <= 0) {
      return 0;
    }
    const remaining = this.grassField.getStates().length;
    const cut = Math.max(0, this.initialGrassTotal - remaining);
    return Math.floor((cut / this.initialGrassTotal) * 100);
  }

  private endRound(): void {
    this.ended = true;
    this.scoreEvents.push({ kind: "clearPercent", percent: this.clearPercent(), mapSize: this.mapSize });
    const summary = summarizeRun(this.scoreEvents, getEconomyStats(this.save), this.mapSize);
    this.roundGold = summary.gold;
    this.save = applyRunResultToSave(this.save, summary);
    saveGame(this.save);
    this.joystick.setVisible(false);
    this.hud.showResult(this.roundGold, {
      onRetry: () => this.app.show("game"),
      onSkills: () => this.app.show("skills"),
      onMenu: () => this.app.show("menu"),
    }, summary, nextAffordableGoals(this.save, 3));
  }

  private readonly updateInputMode = (): void => {
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const useJoystick = coarsePointer || window.innerWidth <= 760;
    this.joystick.setVisible(!this.ended && useJoystick);
  };
}
