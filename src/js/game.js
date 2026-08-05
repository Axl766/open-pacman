// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    dotsEaten: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      // Solo blinky (threshold 0) arranca libre; los demas esperan su umbral.
      released: ( GHOST_RELEASE_DOTS[ g.kind ] || 0 ) === 0,
      threshold: GHOST_RELEASE_DOTS[ g.kind ] || 0,
      bobDir: 'up',
      // Flag "ya salio de la pen": false mientras el fantasma liberado aun no
      // alcanza PEN_EXIT. Incluso blinky (released=true) arranca exited=false
      // hasta que termine de salir. Se consume en moveGhost (SPEC 02).
      exited: false,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
      game.dotsEaten++;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Elige la direccion (entre choices) que minimice la distancia Manhattan
// desde la siguiente celda del fantasma al objetivo (tx, ty).
function greedyTowards( g, choices, tx, ty ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - tx ) + Math.abs( ny - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  const options = Object.keys( DIRS ).filter( ( dir ) => {
    if ( dir === OPPOSITE[ g.dir ] ) return false;
    if ( !canMove( grid, g.x, g.y, dir, 'ghost' ) ) return false;
    // Puerta unidireccional (SPEC 02): un fantasma ya afuera (exited) nunca
    // pisa la puerta (value 3), evitando reentrar a la pen. La rutina
    // exitStep no pasa por aqui, asi que sigue cruzando la puerta al subir.
    if ( g.exited ) {
      const d = DIRS[ dir ];
      if ( grid[ g.y + d.y ][ g.x + d.x ] === 3 ) return false;
    }
    return true;
  } );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  switch ( g.kind ) {
    case 'clyde':
      g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
      return;
    case 'pinky': {
      // Emboscada: 4 celdas por delante de pacman en su direccion actual.
      const pd = DIRS[ p.dir ] || { x: 0, y: 0 };
      const tx = Math.round( p.x ) + 4 * pd.x;
      const ty = Math.round( p.y ) + 4 * pd.y;
      greedyTowards( g, choices, tx, ty );
      return;
    }
    case 'inky': {
      // Vector blinky->(pacman+2) duplicado, suma a blinky. Si blinky no
      // existiera (edge case), cae al propio g como fallback.
      const pd = DIRS[ p.dir ] || { x: 0, y: 0 };
      const t1x = Math.round( p.x ) + 2 * pd.x;
      const t1y = Math.round( p.y ) + 2 * pd.y;
      const blinky = game.ghosts.find( ( o ) => o.kind === 'blinky' ) || g;
      const bx = Math.round( blinky.x );
      const by = Math.round( blinky.y );
      const tx = bx + 2 * ( t1x - bx );
      const ty = by + 2 * ( t1y - by );
      greedyTowards( g, choices, tx, ty );
      return;
    }
    case 'blinky':
    default: {
      const px = Math.round( p.x );
      const py = Math.round( p.y );
      greedyTowards( g, choices, px, py );
      return;
    }
  }
}

// Bobbing vertical dentro de la pen: oscila g.y entre PEN_TOP y PEN_BOTTOM
// con g.speed, invirtiendo g.bobDir en los limites. No aplica wrapTunnel: la
// fila 14 es TUNNEL_ROW, pero wrapTunnel solo actua en x < 0 o x >= width, y
// los fantasmas bloqueados estan en cols 12-15 (no tocan el borde x).
function bobStep( g ) {
  const d = DIRS[ g.bobDir ];
  g.y += d.y * g.speed;
  if ( g.y <= PEN_TOP && g.bobDir === 'up' ) {
    g.y = PEN_TOP;
    g.bobDir = 'down';
  } else if ( g.y >= PEN_BOTTOM && g.bobDir === 'down' ) {
    g.y = PEN_BOTTOM;
    g.bobDir = 'up';
  }
}

// Rutina guionizada de salida de la pen (SPEC 02). Guia a un fantasma ya
// liberado (released && !exited) desde su inicio en la pen hasta el tile fijo
// PEN_EXIT = (13, 11) encima de la puerta. Pasos:
//   1. Si no esta alineado en x=13, moverse horizontalmente hacia la col 13.
//   2. Si ya esta en x=13 pero y > 11, subir recto por la puerta (value 3).
//   3. Al alcanzar (13, 11), fijar la posicion y marcar exited = true; a partir
//      de aqui moveGhost cede el control a decideGhost (IA de personalidad).
// Esta rutina no pasa por decideGhost, asi que puede cruzar la puerta y puede
// invertir la direccion para alinearse (excepcion intencional a la no-reversa).
function exitStep( g ) {
  const gx = Math.round( g.x );
  const gy = Math.round( g.y );
  if ( gx !== PEN_EXIT.x ) {
    g.dir = g.x < PEN_EXIT.x ? 'right' : 'left';
  } else if ( gy > PEN_EXIT.y ) {
    g.dir = 'up';
  } else {
    // Alcanzado el tile de salida: anclaje y cede el control al IA.
    g.x = PEN_EXIT.x;
    g.y = PEN_EXIT.y;
    g.exited = true;
    return;
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Fantasma bloqueado: solo flota en la pen, no decide direccion.
  if ( !g.released ) {
    bobStep( g );
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    // Liberado pero aun dentro de la pen: rutina guionizada hacia PEN_EXIT
    // (puede cruzar la puerta y alinearse a col 13). Ya afuera: IA normal.
    if ( !g.exited ) {
      exitStep( g );
      if ( g.exited ) return; // acabo de llegar a PEN_EXIT; cede al IA en el frame siguiente
      if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
    } else {
      decideGhost( game, g );
      if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
    }
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Preservar released y threshold: quien ya salio no se re-bloquea; los
  // bloqueados siguen esperando su umbral de dots comidos.
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.bobDir = 'up';
    // Reiniciar el flag de salida: tras perder una vida, los liberados deben
    // volver a salir de la pen. No se toca released/threshold (SPEC 01).
    g.exited = false;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );

  // Liberacion escalonada: antes de mover, desbloquear a quien ya alcanzo su
  // umbral de dots comidos.
  for ( const g of game.ghosts ) {
    if ( !g.released && game.dotsEaten >= g.threshold ) g.released = true;
  }

  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
