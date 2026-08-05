# SPEC 02 — Salida de los fantasmas de la pen

**Estado:** Implemented
**Depende de:** SPEC 01
**Fecha:** 2026-08-04
**Objetivo (una frase):** Hacer que los fantasmas liberados salgan de la pen
por la puerta mediante una rutina guionizada hacia un tile fijo de salida,
en lugar de quedar atrapados oscilando dentro de la jaula.

## Por qué existe este spec

SPEC 01 introdujo la liberación escalonada y el bobbing, pero al liberarse un
fantasma su IA (`decideGhost`) apunta con heurística Manhattan hacia pacman,
que arranca en `(13, 23)`, **debajo** de la pen. La única salida de la pen es
la puerta en la fila 12, cols 13–14, es decir, **subiendo**; pero moverse hacia
arriba _aumenta_ la distancia Manhattan a pacman, así que el greedy nunca lo
elige si existe una opción lateral/abajo con menor distancia. Resultado: los
fantasmas liberados oscilan dentro de la pen y nunca salen al mapa.

## Alcance

**Dentro:**

- Nuevo flag `exited` por fantasma y rutina guionizada `exitStep` que guía a un
  fantasma liberado (pero aún `!exited`) desde su inicio en la pen hasta un
  tile fijo de salida encima de la puerta, donde cede el control al IA de
  personalidad de SPEC 01.
- Un único tile fijo de salida `PEN_EXIT = { x: 13, y: 11 }` por el que
  convergen los 4 fantasmas (estilo arcade).
- Puerta unidireccional para fantasmas: `decideGhost` excluye cualquier
  dirección cuyo tile destino sea la puerta (value 3), evitando que un fantasma
  ya afuera reentre a la pen. La rutina de salida (que no usa `decideGhost`)
  sigue atravesando la puerta al subir.
- `resetPositions` reinicia `exited = false` en todos los fantasmas **sin
  tocar `released`**, para que un fantasma liberado vuelva a salir tras perder
  una vida.
- Nueva constante `PEN_EXIT` en `maze.js` (expuesta en `window`).

**Fuera (deferidos a otros specs):**

- Modo asustado (frightened) y reentrada a la pen tras ser comido (eyes
  returning home) — no hay modo frightened aún (pendiente per SPEC 01).
- Velocidad de salida distinta a `GHOST_SPEED` (el arcade usa velocidad menor
  al salir) — las velocidades distintas están fuera de scope per SPEC 01.
- Puntos de salida distintos por fantasma — se decidió tile fijo único.
- Cambiar los umbrales de liberación (`GHOST_RELEASE_DOTS`) o el mecanismo de
  liberación por dots — se mantiene como en SPEC 01.
- Cambios visuales en la renderización de la puerta o la pen.

## Modelo de datos

Nuevo campo por fantasma en `game.ghosts[i]` (`game.js`):

- `exited: boolean` — `false` mientras el fantasma está dentro de la pen tras
  liberarse; `true` una vez alcanza `PEN_EXIT`. Mientras `released && !exited`
  se ejecuta `exitStep`; cuando `exited` se ejecuta `decideGhost` como antes.

Nueva constante en `maze.js`:

```js
const PEN_EXIT = { x: 13, y: 11 }; // tile fijo encima de la puerta (fila 12, cols 13-14)
window.PEN_EXIT = PEN_EXIT;
```

`PEN_EXIT.x` (13) sirve además como columna de alineación de la rutina de
salida: el fantasma se centra en la columna 13 antes de subir recto por la
puerta hasta la fila 11.

El flag `exited` se inicializa en `false` en `createGame` para los 4 fantasmas
(incluso `blinky`, que arranca `released = true` pero `exited = false` hasta
que termine de salir).

## Plan de implementación

Cada paso deja el juego ejecutable.

1. **Datos: `PEN_EXIT` y flag `exited`.** En `maze.js` añadir `PEN_EXIT` y
   exponerlo en `window`. En `createGame` (`game.js`), inicializar
   `exited: false` en cada ghost de `GHOST_STARTS.map( ... )`. Sin usar el flag
   todavía: el comportamiento no cambia (los fantasmas siguen atascados, sin
   regresión). El juego corre igual que antes.
2. **Rutina guionizada de salida.** En `game.js` añadir
   `function exitStep( g )`: si `Math.round( g.x ) !== PEN_EXIT.x`, poner
   `g.dir` hacia la columna 13 (`'right'` si `g.x < 13`, `'left'` si `g.x > 13`);
   si ya está alineado en x=13 y `g.y > PEN_EXIT.y`, poner `g.dir = 'up'`;
   si ya está en `(13, 11)`, fijar `g.x = PEN_EXIT.x`, `g.y = PEN_EXIT.y` y
   `g.exited = true`. En `moveGhost`, sustituir la rama actual por: si
   `!g.released` → `bobStep` (igual que antes); si `g.released && !g.exited` →
   `exitStep( g )` (en lugar de `decideGhost`); si `g.exited` → `decideGhost`.
   Verificar en navegador: `blinky` sale de la pen al iniciar la partida y
   persigue a pacman; los demás bobbean hasta su umbral y entonces salen.
3. **Puerta unidireccional (sin reentrada).** En `decideGhost` (`game.js`),
   añadir al filter de `options` una condición que descarte cualquier
   dirección cuyo tile destino sea puerta (`grid[ ty ][ tx ] === 3`). Así los
   fantasmas ya `exited` nunca pisan la puerta y no reentran a la pen; la
   rutina `exitStep` (que no pasa por `decideGhost`) sigue cruzando la puerta
   al subir. Verificar: tras salir, ningún fantasma vuelve a entrar a la pen
   aunque pacman pase cerca de la fila 12.
4. **Reset de `exited` al perder una vida.** En `resetPositions` (`game.js`),
   añadir `g.exited = false` para cada ghost dentro del `forEach` existente,
   **sin modificar** `released` ni `threshold` (se preserva lo decidido en
   SPEC 01). Verificar en navegador: al perder una vida, los fantasmas
   liberados vuelven a su inicio en la pen y salen de nuevo; los bloqueados
   siguen esperando su umbral. La consola no arroja errores y la partida sigue
   siendo ganable y perdible.

## Criterios de aceptación (verificables en navegador)

- [ ] Al iniciar la partida, `blinky` (umbral 0) sale de la pen de inmediato y
      empieza a perseguir a pacman; ya no oscila atrapado en la jaula.
- [ ] `pinky` sale tras ~5 dots, `inky` tras ~20, `clyde` tras ~40; cada uno
      abandona la pen por la puerta (no se queda atrapado).
- [ ] Todos los fantasmas salen por el mismo tile fijo `PEN_EXIT = (13, 11)`
      encima de la puerta y desde ahí continúan con su IA de personalidad.
- [ ] Mientras están bloqueados (antes de su umbral) los fantasmas siguen
      haciendo bobbing dentro de la pen como antes.
- [ ] Ningún fantasma que ya salió vuelve a entrar a la pen por la puerta (la
      puerta es unidireccional para fantasmas ya afuera).
- [ ] Al perder una vida, los fantasmas liberados vuelven a su punto de inicio
      en la pen y salen de nuevo; los aún bloqueados siguen esperando su
      umbral.
- [ ] El juego sigue siendo ganable (comer todos los dots) y perdible (3 vidas)
      como antes.
- [ ] La consola del navegador no muestra errores durante la partida.

## Decisiones tomadas y descartadas

- **Adoptado:** rutina de salida guionizada (camino fijo) sobre greedy con
  target temporal, porque garantiza que el fantasma siempre salga sin depender
  de la heurística Manhattan —que era justo la causa del bug, ya que apuntar a
  pacman aleja al fantasma de la puerta.
- **Adoptado:** un único tile fijo de salida `PEN_EXIT = (13, 11)` encima de la
  puerta, por el que convergen los 4 fantasmas (estilo arcade clásico).
- **Adoptado:** flag `exited` por fantasma para marcar "ya salió de la pen", en
  lugar de detectar el interior por posición (bounding box); el estado
  explícito es más fácil de razonar y no reparte coordenadas mágicas.
- **Adoptado:** puerta unidireccional implementada filtrando tiles de puerta
  (value 3) dentro de `decideGhost`. La rutina `exitStep` no usa `decideGhost`,
  así que sigue cruzando la puerta al subir sin verse afectada.
- **Adoptado:** `resetPositions` reinicia `exited = false` sin tocar
  `released`/`threshold`, coherente con SPEC 01 (preservar liberaciones).
- **Descartado:** velocidad de salida distinta a `GHOST_SPEED` — las
  velocidades por estado están fuera de scope per SPEC 01.
- **Descartado:** detección por posición / bounding box de la pen — el flag
  `exited` es más claro.
- **Descartado:** puntos de salida distintos por fantasma — se decidió tile
  fijo único.

## Riesgos identificados

- **Colisión entre fantasmas al salir por un único tile.** Los 4 pasan por
  `(13, 11)`; si dos se liberan casi a la vez pueden solaparse en la puerta.
  Mitigación: los umbrales (0/5/20/40) están separados, así que rara vez
  coinciden; además el solapamiento es solo visual (no afecta la lógica).
- **`exitStep` ignora la regla de no-reversa.** La rutina guionizada puede
  invertir la dirección para alinearse con la columna 13; es intencional
  durante la salida. Una vez `exited = true`, `decideGhost` vuelve a respetar
  la no-reversa.
- **Puerta tratada como muro en `decideGhost`.** Si un fantasma ya fuera queda
  acorralado contra la puerta y la única salida fuera reentrar, el fallback de
  callejón (giro de 180°) lo saca por la dirección opuesta, no por la puerta.
  Comportamiento correcto.

## Lo que **no** está en este spec

- Modo asustado y reentrada de ojos a la pen tras ser comido (va con el spec
  de frightened / power pellets).
- Velocidad de salida distinta (va con el spec de velocidades por estado).
- Puntos de salida por fantasma (descartado; tile fijo único).
- Renumerar umbrales o cambiar el mecanismo de liberación por dots (se mantiene
  lo de SPEC 01).

Cada uno de esos, si llega, va en su propio spec.
