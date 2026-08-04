# SPEC 01 — IA de los 4 fantasmas

**Estado:** Approved
**Depende de:** —
**Fecha:** 2026-08-04
**Objetivo (una frase):** Añadir 4 fantasmas con personalidades de IA distintas
(blinky agresiva, pinky emboscada, inky vectores con blinky, clyde aleatoria)
y liberación escalonada por dots comidos, con colores arcade y velocidad
igual para todos.

## Alcance

**Dentro:**

- Ampliar `GHOST_STARTS` de 2 a 4 fantasmas con `kind` arcade.
- Renombrar los `kind` actuales: `'hunter'` → `'blinky'`, `'random'` → `'clyde'`.
- Implementar dos IA nuevas (`pinky`, `inky`) según el modelo arcade clásico.
- Liberación escalonada: cada fantasma sale de la pen al comer N dots.
- Bobbing vertical dentro de la pen para los fantasmas aún bloqueados.
- Reordenar `GHOST_COLORS` en render.js a `[rojo, rosa, cian, naranja]` para
  alinear con `[blinky, pinky, inky, clyde]`.

**Fuera (deferidos a otros specs):**

- Modo dispersión (scatter) y modo asustado (frightened / power pellets).
- Velocidades distintas por fantasma o por estado.
- Tunel lento (slowdown) para fantasmas.
- Bug de overflow del arcade en Pinky al mirar arriba (no se replica).
- Liberación escalonada por nivel/tiempo (úsese solo el contador de dots).

## Modelo de datos

Nuevo estado en `game` (`game.js`):

- `game.dotsEaten: number` — contador de dots comidos, se incrementa al comer.

Nuevos campos por fantasma en `game.ghosts[i]`:

- `kind: 'blinky' | 'pinky' | 'inky' | 'clyde'`
- `released: boolean` — `true` si ya puede salir de la pen y usar su IA.
- `threshold: number` — dots que pacman debe comer antes de liberarlo.
- `bobDir: 'up' | 'down'` — dirección actual del bobbing mientras está bloqueado.

Constantes nuevas (`maze.js` o `game.js`):

- `GHOST_RELEASE_DOTS = { blinky: 0, pinky: 5, inky: 20, clyde: 40 }`
- `PEN_TOP = 13`, `PEN_BOTTOM = 15` — rango vertical del bobbing.

`GHOST_STARTS` pasa a:

- `{ x: 13, y: 14, kind: 'blinky' }`
- `{ x: 14, y: 14, kind: 'pinky' }`
- `{ x: 12, y: 14, kind: 'inky' }`
- `{ x: 15, y: 14, kind: 'clyde' }`

(Columnas 12–15 distintas, fila 14, dentro de la pen.)

`GHOST_COLORS` reordenado a:
`[ '#ff0000', '#ffb8ff', '#00ffff', '#ffb852' ]` (rojo, rosa, cian, naranja),
alineado con el índice de cada fantasma en `GHOST_STARTS`.

## Plan de implementación

Cada paso deja el juego ejecutable.

1. **Renombrar kinds y refactorizar `decideGhost`.** En `maze.js` ampliar
   `GHOST_STARTS` a 4 entradas con kinds arcade y posiciones indicadas arriba.
   Añadir `GHOST_RELEASE_DOTS`, `PEN_TOP`, `PEN_BOTTOM`, y reordenar
   `GHOST_COLORS` en `render.js`. En `game.js`, crear
   `game.dotsEaten = 0` y dar a cada ghost `released = (kind === 'blinky')` y
   `threshold = GHOST_RELEASE_DOTS[ kind ]`. Convertir `decideGhost` en un
   `switch` por `kind`: `blinky` → lógica agresiva existente, `clyde` →
   lógica aleatoria existente, `pinky`/`inky` → **provisionalmente igual a
   blinky** (placeholder, para mantener runnable). Sin liberación aún: todos
   `released=true` menos —espera— blinky ya true; el resto se marcan también
   `true` en este paso para no romper el juego (la liberación se activa en el
   paso 3). El juego corre con 4 fantasmas, 2 IAs reales y 2 placeholders.
2. **Implementar `pinky` e `inky`.** Sustituir los placeholders:
   - `pinky`: objetivo = celda de pacman + `4 * DIRS[ pacman.dir ]`. Elegir
     dirección (excluyendo reversa) que minimice distancia Manhattan al
     objetivo.
   - `inky`: `target1 = pacman + 2 * DIRS[ pacman.dir ]`; obtener `blinky`
     (`game.ghosts.find( g => g.kind === 'blinky' )`, con fallback al propio
     `g` si no existe); `target = blinky + 2 * ( target1 − blinky )`; elegir
     dirección que minimice Manhattan a `target`.
     Verificar en navegador: blinky sigue directo, pinky tiende a cortar paso,
     inky traza rutas erráticas, clyde vaga.
3. **Liberación escalonada + bobbing.** En `createGame`, poner
   `released = ( threshold === 0 )` (solo blinky true) y `bobDir = 'up'`.
   En `movePacman`, sumar `game.dotsEaten++` al comer un dot. En `update`,
   antes de mover fantasmas: para cada ghost con `!released`, si
   `game.dotsEaten >= g.threshold` → `g.released = true`. En `moveGhost`:
   si `!g.released`, ejecutar `bobStep( g )` (oscilar `g.y` entre `PEN_TOP` y
   `PEN_BOTTOM` invirtiendo `g.bobDir` en los límites, usando `g.speed`) y
   retornar sin decidir dirección. En `resetPositions`, **preservar**
   `released` y `threshold` (no re-bloquear a quien ya salió; los bloqueados
   siguen esperando su umbral).
4. **Colores arcade definitivos.** Confirmar `GHOST_COLORS` reordenado del
   paso 1 (rojo, rosa, cian, naranja) coincide con el orden de `GHOST_STARTS`.
   Verificar visualmente cada fantasma con su color en el navegador y que la
   consola no arroje errores.

## Criterios de aceptación (verificables en navegador)

- [ ] Hay 4 fantasmas visibles desde el arranque, todos dentro de la pen.
- [ ] Cada fantasma tiene un color distinto y estable: blinky rojo, pinky
      rosa, inky cian, clyde naranja.
- [ ] `blinky` persigue directamente a pacman (dirección de menor Manhattan
      hacia la celda de pacman).
- [ ] `pinky` intercepta avanzando ~4 celdas en la dirección actual de
      pacman (se le ve cortar el paso cuando pacman avanza en línea recta).
- [ ] `inky` traza un movimiento errático que depende de la posición de
      blinky (moviendo a blinky se altera el patrón de inky).
- [ ] `clyde` se mueve de forma aleatoria, sin preferencia por pacman.
- [ ] Al iniciar, solo `blinky` sale de la pen de inmediato.
- [ ] `pinky` sale tras ~5 dots, `inky` tras ~20, `clyde` tras ~40.
- [ ] Mientras están bloqueados, los fantasmas flotan arriba/abajo dentro de
      la pen (bobbing) sin salirse de ella.
- [ ] Al perder una vida, los fantasmas liberados salen de nuevo (no
      vuelven a bloquearse); los aún bloqueados siguen esperando su umbral.
- [ ] El juego sigue ganable (comer todos los dots) y perdible (3 vidas)
      como antes.
- [ ] La consola del navegador no muestra errores durante la partida.

## Decisiones tomadas y descartadas

- **Adoptado:** modelo arcade clásico para pinky e inky (no versiones
  simplificadas), porque es lo que el jugador espera y no añade complejidad
  notable sobre el greedy Manhattan existente.
- **Adoptado:** `clyde` se mantiene como IA aleatoria (renombrado del
  `random` actual) en lugar de su IA arcade real (caza-lejano / huye-cerca),
  para minimizar scope. Su IA arcade real queda pendiente para un spec
  futuro.
- **Adoptado:** liberación por contador de dots con umbrales fijos y
  tuneables (0/5/20/40); sin dependencia de nivel ni de tiempo.
- **Adoptado:** bobbing vertical entre las filas 13 y 15, una columna
  distinta por fantasma (cols 12–15) para evitar solapamiento visual.
- **Adoptado:** al morir pacman se preserva el estado `released` (no se
  reinicia el contador de dots ni se re-bloquea a nadie).
- **Descartado:** replicar el bug de overflow de Pinky del arcade original
  (apuntaba a (−4,−4) al mirar arriba) — es un bug histórico, no un
  comportamiento deseado.
- **Descartado (fuera de scope):** scatter, frightened, velocidades
  distintas, tunel lento — se dejan para specs posteriores.

## Riesgos identificados

- **`inky` depende de `blinky`.** Si por algún edge case `blinky` no está en
  `game.ghosts`, el `find` devuelve `undefined`. Mitigación: fallback al
  propio `g` (documentado en el código).
- **Bobbing en fila 14 (tunel).** La fila 14 es `TUNNEL_ROW`; `wrapTunnel`
  solo actúa en `x < 0 || x >= width`, así que estar en cols 11–16 a la
  altura del túnel no provoca wrap. Sin riesgo, pero conviene dejar un
  comentario recordando por qué no se aplica `wrapTunnel` al bobbing.
- **4 fantasmas pueden hacer la partida muy difícil.** Umbrales altos para
  inky/clyde (20/40) dan respiro inicial; se puede re-tunear en
  `GHOST_RELEASE_DOTS` sin tocar lógica.
- **Solapamiento visual inicial.** Si dos fantasmas comparten columna y
  bobbean, se overlapping. Mitigado asignando columnas 12–15 distintas.
