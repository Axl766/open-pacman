# SPEC 03 — Power pellets y modo asustado (frightened)

**Estado:** Approved
**Depende de:** SPEC 01, SPEC 02
**Fecha:** 2026-08-04
**Objetivo (una frase):** Añadir 4 power pellets en las esquinas que, al comerlos, ponen a los fantasmas en modo asustado (huyen, pacman puede comerlos) durante un tiempo fijo, con puntuación en cadena (200/400/800/1600) y reentrada de ojos a la pen.

## Alcance

**Dentro:**

- Nuevo tile de power pellet (valor `4`, char `'*'` en `MAZE_STR`) en las 4 esquinas canónicas del laberinto: `(1, 3)`, `(26, 3)`, `(1, 23)`, `(26, 23)`.
- Detección de comida de power pellet en `movePacman` (`grid[ y ][ x ] === 4`): da 50 puntos, decrementa `dotsRemaining`, incrementa `dotsEaten` (cuenta para liberación), y activa el modo asustado global.
- Estado global de fright: `game.frightTimer` (frames restantes, `0` = inactivo) y `game.frightChain` (0..3, para doblar puntos del siguiente fantasma comido en la misma cadena).
- Reversión inmediata de dirección de todos los fantasmas `exited` al activarse el modo asustado (conducta arcade clásica).
- IA de huida: en `decideGhost`, si `frightTimer > 0` y el fantasma no está siendo comido, elegir (sin reversa, salvo callejón) la dirección que **maximice** la distancia Manhattan a pacman (greedy alejándose). Misma velocidad `GHOST_SPEED` (las velocidades por estado siguen fuera de scope per SPEC 01).
- Estado por fantasma `g.eaten: boolean`: al colisionar pacman con un fantasma asustado, el fantasma se vuelve "ojos" (sin cuerpo), suma `200 * 2^frightChain` al score, e incrementa `frightChain` (tope 3 → 1600).
- Rutina `eyesStep` para guiar al fantasma comido de vuelta a la pen: alinear a col 13, bajar por la puerta (valor 3) hasta su `GHOST_START`. Al llegar, `g.eaten = false`, `g.exited = false` (de modo que `exitStep` de SPEC 02 lo saca de nuevo), `g.released` se mantiene `true`.
- Render: power pellet como círculo mayor pulsante (radio ~6, blanca); fantasmas asustados en azul oscuro `#2121ff` parpadeando a blanco en los últimos ~2s; fantasmas comidos dibujados solo como ojos (sin cuerpo).
- `resetPositions` apaga el modo asustado (`frightTimer = 0`, `frightChain = 0`) y reinicia `eaten = false` por fantasma (los ojos en camino vuelven a su punto de inicio y re-salen). Esto evita estados extraños tras perder una vida.

**Fuera (deferidos a otros specs):**

- Velocidades por estado (fantasma asustado más lento, ojos más rápido) — fuera de scope per SPEC 01.
- Decaimiento del fright por nivel o por dots restantes (en arcade baja con el nivel). Aquí es fijo.
- Timeout de "fin de fase asustada" simultáneo en varios power pellets encadenados (comer otro power pellet reinicia el timer, no acumula).
- Scatter mode (siempre fuera per SPEC 01).
- Animación de puntos flotantes (200/400/...) sobre la celda del fantasma comido.
- Sonido.

## Modelo de datos

Tiles (`maze.js`, `parseTile`):

- `'*'` → `4` (power pellet). Esta celda NO se cuenta doble: es transitable como un dot.

Posiciones en `MAZE_STR`: sustituir los `'.'` existentes en `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` por `'*'`. El laberinto sigue simétrico respecto al eje vertical central.

Nueva constante en `maze.js`:

```js
const POWER_PELLETS = [
  { x: 1, y: 3 },
  { x: 26, y: 3 },
  { x: 1, y: 23 },
  { x: 26, y: 23 },
];
window.POWER_PELLETS = POWER_PELLETS;
```

(No la usa la lógica, solo documentación/render; el flag real es `grid[ y ][ x ] === 4`.)

Nuevas constantes en `game.js`:

```js
const POWER_PELLET_SCORE = 50;
const GHOST_EATEN_SCORE = [200, 400, 800, 1600]; // indexado por frightChain
const FRIGHT_FRAMES = 420; // ~7s a 60fps; 0 = inactivo
const FRIGHT_BLINK_FRAMES = 120; // ultimos ~2s parpadean en render
```

Nuevo estado en `game` (`createGame`):

- `game.frightTimer: number` (inicia `0`).
- `game.frightChain: number` (inicia `0`).

Nuevo campo por fantasma en `game.ghosts[i]`:

- `g.eaten: boolean` — `true` mientras es "ojos" volviendo a la pen. Inicia `false`.

Conteo de dots en `createGame`: ya hay un loop `for ( const v of row ) if ( v === 2 )`. Se amplía a `if ( v === 2 || v === 4 )`. `game.dotsRemaining` incluye power pellets (un power pellet = un dot a efectos de win).

## Plan de implementación

Cada paso deja el juego ejecutable.

1. **Datos y render del power pellet.** En `maze.js`: añadir `'*'` a las 4 posiciones en `MAZE_STR`; ampliar `parseTile` con `if ( ch === '*' ) return 4;`; añadir y exponer `POWER_PELLETS`. En `game.js`, ampliar el conteo de `dotsRemaining` a `v === 2 || v === 4`. En `render.js`, añadir una rama en `drawDots` (o un `drawPowerPellets`) que dibuje el tile `4` como círculo blanco de radio ~6 pulsando con `frame` (`Math.sin( frame * 0.2 ) * 1.5 + 5`). Verificar en navegador: 4 pellets grandes pulsantes en las esquinas; al comerlos (lógica aún sin distinguirlos del dot comun) **siguen avanzando** el contador `dotsRemaining` igual que antes. Sin regresión.
2. **Detección de power pellet + estado global.** En `movePacman` (`game.js`): rama nueva cuando `grid[ p.y ][ p.x ] === 4` — poner a `0`, `+= POWER_PELLET_SCORE`, `dotsRemaining--`, `dotsEaten++`, y `game.frightTimer = FRIGHT_FRAMES; game.frightChain = 0;`. (Si ya había un fright activo, se reinicia el timer y la cadena vuelve a 0 — arcade classic.) En `createGame`, inicializar `frightTimer: 0, frightChain: 0`. En `update`, antes de mover fantasmas, decrementar `game.frightTimer` (con cota `>= 0`); cuando llega a `0`, todos los `g.eaten` se quedan (los ojos siguen volviendo), todos los no-`eaten` vuelven a la normalidad automáticamente (no hay flag que limpiar: `frightTimer === 0` ya es la condición). Verificar: comer un power pellet da 50 pts y **no rompe nada** (aún no cambia el comportamiento de los fantasmas).
3. **IA de huida + reversión inicial.** En `decideGhost` (`game.js`), al inicio: `const frightened = game.frightTimer > 0 && !g.eaten;`. Si `frightened`, elegir la dirección que **maximice** la distancia Manhattan a pacman entre `choices` (variante de `greedyTowards` con `>`, o un `greedyAway`). Si entra en modo asustado (en `movePacman` tras setear `frightTimer`), recorrer `game.ghosts` y poner `g.dir = OPPOSITE[ g.dir ]` para los `!g.eaten && g.exited` (los que están en la pen o son ojos no revierten — arcade: solo los activos en el mapa). Verificar: comer power pellet invierte a los fantasmas en el mapa y los hace alejarse de pacman.
4. **Comer fantasma + ojos.** En `update`, en el bloque de colisión actual (`if ( collides( pacman, g ) )`): si `game.frightTimer > 0 && !g.eaten`, sumar `GHOST_EATEN_SCORE[ game.frightChain ]` (clampeado al último valor), `game.frightChain = Math.min( game.frightChain + 1, 3 )`, `g.eaten = true`, y **no** decrementar vidas ni resetear (el fantasma "muere", pacman sigue). Si `!frightTimer || g.eaten` (no asustado o ya es ojos), pacman muere (lógica actual). En `moveGhost`, nueva rama antes de las existentes: si `g.eaten`, ejecutar `eyesStep( g )` (ver paso 5) en lugar de `bobStep`/`exitStep`/`decideGhost`. Verificar: pacman puede comer un fantasma azul (score sube 200), el fantasma desaparece como cuerpo y se ve solo ojos moviéndose.
5. **Rutina de ojos (`eyesStep`).** Espejo de `exitStep` pero descendiendo. Lógica:
   - `gx = round(g.x)`, `gy = round(g.y)`.
   - Si `gx !== 13`: `g.dir = g.x < 13 ? 'right' : 'left'`.
   - Si `gx === 13` y `gy < 14`: `g.dir = 'down'` (atraviesa la puerta valor 3).
   - Si `gy === 14 && gx === 13`: anclar `(13, 14)`, `g.eaten = false`, `g.exited = false` (cede a `exitStep` para re-salir), `g.dir = 'up'`.
     Los ojos **no** pasan por `decideGhost`, así que pueden cruzar la puerta libremente (la regla de puerta unidireccional de SPEC 02 solo aplica dentro de `decideGhost`). Verificar: tras comer un fantasma, sus ojos vuelven a la pen y el fantasma re-emerge corriendo.
6. **Render de asustado + ojos.** En `render.js`, en el `forEach` de `draw` de fantasmas: si `game.frightTimer > 0 && !g.eaten`, color de cuerpo = `#2121ff`, parpadeando a `#ffffff` en los últimos `~120` frames (alternando por frame, p. ej. `frame % 16 < 8`); si `g.eaten`, dibujar SOLO los ojos (omitir el `fill` del cuerpo, llamar solo a la sección de ojos). Verificar visualmente los tres estados (normal / asustado azul / parpadeo / ojos solos).
7. **Reset al perder una vida.** En `resetPositions` (`game.js`): `game.frightTimer = 0; game.frightChain = 0;` y dentro del `forEach` de ghosts, `g.eaten = false;` (ya se recomendaba `g.exited = false`). Sin tocar `released`/`threshold` (per SPEC 01). Verificar: perder una vida apaga el modo asustado y los ojos en vuelo vuelven a aparecer como fantasma normal en su `GHOST_START` y re-salen.

## Criterios de aceptación (verificables en navegador)

- [ ] Hay 4 power pellets visibles en las esquinas `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)` como círculos blancos grandes pulsantes.
- [ ] Comer un power pellet vale 50 puntos, decrementa `dotsRemaining` y cuenta para ganar el nivel (un pellets comido ≡ un dot para win).
- [ ] Al comer un power pellet, todos los fantasmas `exited` en el mapa **revierten la dirección** en el acto (conducta arcade).
- [ ] Mientras `frightTimer > 0`, los fantasmas se ven azul oscuro `#2121ff` (parpadeando a blanco en los últimos ~2s) y huyen alejándose de pacman en lugar de perseguirlo.
- [ ] Comer un fantasma asustado otorga 200, 400, 800 y 1600 en orden dentro del mismo power pellet (cadena visible en el score). Tras el 4º fantasma, comer más en la misma cadena (si estuviera activo) sigue dando 1600.
- [ ] Comer un segundo power pellet durante un fright activo **reinicia** el timer y la cadena vuelve a 0 (no acumula tiempo/pts).
- [ ] Un fantasma comido se dibuja solo como ojos (sin cuerpo azul) y regresa por el mapa hasta entrar a la pen por la puerta, tras lo cual re-emerge por `PEN_EXIT = (13,11)` y vuelve a comportarse normalmente (persecución o huida según `frightTimer`).
- [ ] Mientras es ojos, el fantasma no daña a pacman (no cuenta como colisión mortal) aunque lo toque.
- [ ] El modo asustado se apaga solo tras ~7s (si nadie fue comido, los fantasmas vuelven a perseguir sin requerir comer nada).
- [ ] Perder una vida apaga el modo asustado (timer/chain a 0), reinicia a los ojos a sus posiciones de inicio y salen de nuevo; los `released`/`threshold` no se re-bloquean (per SPEC 01).
- [ ] El juego sigue ganable (comer todos los dots **y** los 4 power pellets) y perdible (3 vidas).
- [ ] La consola del navegador no muestra errores durante toda la partida.

## Decisiones tomadas y descartadas

- **Adoptado:** tile `4` con char `'*'` para power pellet — mantiene el convenio numérico existente (`0..3`) sin pisar valores en uso.
- **Adoptado:** 4 posiciones en las esquinas canónicas `(1,3)/(26,3)/(1,23)/(26,23)`, sustituyendo los dots existentes en esas celdas. Simétricas y fieles al laberinto actual.
- **Adoptado:** el power pellet **cuenta como dot** para `dotsRemaining` (ganar el nivel requiere comer los 4) y para `dotsEaten` (cuenta para liberar a pinky/inky/clyde).
- **Adoptado:** `FRIGHT_FRAMES = 420` (~7s @ 60fps) fijo y tuneable; sin decaimiento por nivel ni por dots restantes.
- **Adoptado:** puntuación en cadena arcade `200/400/800/1600` indexada por `frightChain`; comer otro power pellet resetea la cadena a 0.
- **Adoptado:** reversión inmediata de `g.dir` para fantasmas ya `exited` y no-eaten al activar el fright (arcade clásico). Los que están en la pen (`!released` o `!exited`) no revierten.
- **Adoptado:** flag explícito `g.eaten` (true = ojos volviendo) sobre detección por color de render — coherente con cómo SPEC 02 modeló `exited`.
- **Adoptado:** rutina `eyesStep` guionizada (espejo descendente de `exitStep`) en lugar de greedy con permiso de cruzar puerta — garantiza reentrada sin edge cases por heurística.
- **Adoptado:** al reaparecer en pen, `g.eaten = false` y `g.exited = false` (reutiliza `exitStep` de SPEC 02 para re-salir). `released` se respeta.
- **Adoptado:** parpadeo a blanco en los últimos ~2s para feedback de fin de fright; el arcade en sus últimos 30 frames parpadea más rápido — por simplicidad se usa un patrón regular.
- **Descartado:** velocidades distintas para asustado (más lento) y ojos (más rápido) — fuera de scope per SPEC 01.
- **Descartado:** decaimiento del fright por nivel/dots — se mantiene constante en esta versión.
- **Descartado:** animación de puntos flotantes "200/400/..." sobre la celda del fantasma comido — puramente cosmético, fuera de scope.
- **Descartado:** añadir sonido / SFX de power pellet — fuera de scope.

## Riesgos identificados

- **Eyes + puertas y túnel.** `eyesStep` no usa `canMove` ni `decideGhost`, así que atraviesa la puerta valor 3 (intencional). Si por posición inicial el fantasma comido está en la fila del túnel, `wrapTunnel` se sigue aplicando en `moveGhost` tras `eyesStep` (no se salta), así que el túnel sigue funcionando. Sin riesgo, pero comentar en el código que `eyesStep` puede cruzar la puerta a propósito.
- **Eyes + reversión inicial del siguiente power pellet.** Si pacman come un 2º power pellet mientras un fantasma es ojos (`g.eaten`), la reversión del paso 3 **no** lo afecta (está `eaten`, no `exited`). Bien: los ojos deben seguir a la pen sin invertirse. Caso borde cubierto por la condición `g.exited` (los `eaten` no son `exited`).
- **`frightChain` clamp.** Si por lag el contador llegara a >3, el index de `GHOST_EATEN_SCORE` daría `undefined`. Mitigación: `Math.min( chain, 3 )` al leer; también se accede como `GHOST_EATEN_SCORE[ Math.min( game.frightChain, 3 ) ]` defensivamente.
- **4 fantasmas → cadena >4 inalcanzable.** Solo hay 4 fantasmas, así que la cadena real máximo es 4 (índices 0..3). Después del 4º, si pacman comiera "otro" en el mismo fright (imposible: ya todos son ojos), no aplica. Sin riesgo real.
- **`update` decremento de `frightTimer`.** Se decrementa una vez por frame, sin importar el estado. Si el juego se pausa (no hay pausa aún), el timer se congela naturalmente porque `update` no se llama. Sin riesgo.
- **Clyde durante fright.** El paso 3 reescribe `decideGhost` para todos en fright (greedy-alejándose), así que clyde pierde su aleatoriedad durante fright. Esto es coherente con el arcade, donde NINGUN fantasma es aleatorio durante fright. Documentar en código.

## Lo que **no** está en este spec

- Velocidades por estado (`FrightSpeed`, `EyesSpeed`) — va con el spec de velocidades.
- Decaimiento del fright por nivel o por dots restantes — va con un futuro spec de niveles.
- Animación de score flotante al comer fantasma — cosmético, futuro spec visual.
- Sonido / SFX — futuro spec de audio.

Cada uno, si llega, va en su propio spec.
