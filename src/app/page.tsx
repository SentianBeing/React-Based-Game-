
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Coins, HeartCrack, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import Image from 'next/image';

// Game Constants
const GAME_ASPECT_RATIO = 1;
const BASE_GAME_WIDTH = 520;
const BASE_GAME_HEIGHT = 520;
const GRAVITY = 0.5;
const PLAYER_SPEED = 5;
const JUMP_STRENGTH = 12;
const WALK_ANIMATION_SPEED = 8; // Lower is faster

// Types
type GameState = 'start' | 'playing' | 'gameOver' | 'win';

interface GameObject {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Player extends GameObject {
  vx: number;
  vy: number;
  onGround: boolean;
  direction: 'left' | 'right';
  isWalking: boolean;
  walkFrame: number;
}

interface Enemy extends GameObject {
  vx: number;
  initialX: number;
  range: number;
}

interface Coin extends GameObject {
  collected: boolean;
}

interface Platform extends GameObject {}

// Level Data, adjusted for new world size
const initialLevel = {
  platforms: [
    { id: 1, x: 0, y: 470, width: 520, height: 50 },
    { id: 2, x: 600, y: 470, width: 400, height: 50 },
    { id: 3, x: 1100, y: 380, width: 200, height: 20 },
    { id: 4, x: 1400, y: 300, width: 200, height: 20 },
    { id: 5, x: 1700, y: 470, width: 600, height: 50 },
    { id: 6, x: 2000, y: 350, width: 150, height: 20 },
    { id: 7, x: 2400, y: 470, width: 800, height: 50 },
  ],
  coins: [
    { id: 1, x: 700, y: 420, width: 25, height: 25, collected: false },
    { id: 2, x: 1150, y: 330, width: 25, height: 25, collected: false },
    { id: 3, x: 1450, y: 250, width: 25, height: 25, collected: false },
    { id: 4, x: 2050, y: 300, width: 25, height: 25, collected: false },
    { id: 5, x: 2200, y: 420, width: 25, height: 25, collected: false },
  ],
  enemies: [
    { id: 1, x: 800, y: 430, width: 40, height: 40, vx: 1, initialX: 800, range: 150 },
    { id: 2, x: 1900, y: 430, width: 40, height: 40, vx: -1, initialX: 1900, range: 150 },
  ],
  prince: { id: 1, x: 2900, y: 410, width: 40, height: 60 },
};

const createInitialPlayer = (): Player => ({
  id: 1,
  x: 50,
  y: 0,
  width: 32,
  height: 48,
  vx: 0,
  vy: 0,
  onGround: false,
  direction: 'right',
  isWalking: false,
  walkFrame: 0,
});

const PankhuSpriteIdle = () => (
    <Image src="https://placehold.co/32x48.png" alt="Pankhu Idle" layout="fill" objectFit="contain" data-ai-hint="pixelated princess idle" />
);

const PankhuSpriteWalk1 = () => (
    <Image src="https://placehold.co/32x48.png" alt="Pankhu Walk 1" layout="fill" objectFit="contain" data-ai-hint="pixelated princess walk" />
);

const PankhuSpriteWalk2 = () => (
    <Image src="https://placehold.co/32x48.png" alt="Pankhu Walk 2" layout="fill" objectFit="contain" data-ai-hint="pixelated princess walk" />
);

const PankhuSpriteJump = () => (
    <Image src="https://placehold.co/32x48.png" alt="Pankhu Jump" layout="fill" objectFit="contain" data-ai-hint="pixelated princess jump" />
);


const PlayerSprite = ({ isWalking, onGround, walkFrame }: { isWalking: boolean, onGround: boolean, walkFrame: number }) => {
    if (!onGround) {
        return <PankhuSpriteJump />;
    }
    if (isWalking) {
        return walkFrame === 0 ? <PankhuSpriteWalk1 /> : <PankhuSpriteWalk2 />;
    }
    return <PankhuSpriteIdle />;
};

const PrinceSprite = () => {
    return (
       <Image src="https://placehold.co/40x60.png" alt="Prince" layout="fill" objectFit="contain" data-ai-hint="pixelated prince" />
    );
}

// Game Component
export default function PankhusQuest() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [player, setPlayer] = useState<Player>(createInitialPlayer);
  const [coins, setCoins] = useState<Coin[]>(initialLevel.coins);
  const [enemies, setEnemies] = useState<Enemy[]>(initialLevel.enemies);
  const [score, setScore] = useState(0);
  const [cameraX, setCameraX] = useState(0);
  const [gameDimensions, setGameDimensions] = useState({ width: BASE_GAME_WIDTH, height: BASE_GAME_HEIGHT });
  const [isMobile, setIsMobile] = useState(false);
  
  const gameContainerRef = useRef<HTMLDivElement>(null);

  const keysPressed = useRef<Record<string, boolean>>({});
  const gameLoopRef = useRef<number>();
  const lastFrameTime = useRef(performance.now());
  const walkFrameCounter = useRef(0);

  const resetGame = useCallback(() => {
    setPlayer(createInitialPlayer());
    setCoins(initialLevel.coins.map(c => ({ ...c, collected: false })));
    setEnemies(initialLevel.enemies);
    setScore(0);
    setCameraX(0);
    setGameState('playing');
  }, []);

  useEffect(() => {
    const checkIsMobile = () => {
      const isMobileDevice = window.innerWidth < 768;
      if(isMobile !== isMobileDevice) {
        setIsMobile(isMobileDevice);
      }
    };
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, [isMobile]);

  useEffect(() => {
    const handleResize = () => {
      if (gameContainerRef.current) {
        const parent = gameContainerRef.current.parentElement;
        if (!parent) return;

        const parentWidth = parent.clientWidth;
        const parentHeight = parent.clientHeight;
        
        let newWidth = parentWidth;
        let newHeight = newWidth / GAME_ASPECT_RATIO;

        if (newHeight > parentHeight) {
            newHeight = parentHeight;
            newWidth = newHeight * GAME_ASPECT_RATIO;
        }

        setGameDimensions({
            width: newWidth,
            height: newHeight,
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        if(e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
        keysPressed.current[e.key] = true; 
    };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleTouchStart = (key: string) => (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    keysPressed.current[key] = true;
  };
  const handleTouchEnd = (key: string) => (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    keysPressed.current[key] = false;
  };

  const handleMouseDown = (key: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    keysPressed.current[key] = true;
  };

  const handleMouseUp = (key: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
     e.preventDefault();
    keysPressed.current[key] = false;
  }
  
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return;

    setPlayer(p => {
      let newVx = 0;
      let newDirection = p.direction;
      let isWalking = false;

      if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) {
        newVx = -PLAYER_SPEED;
        newDirection = 'left';
        isWalking = true;
      }
      if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) {
        newVx = PLAYER_SPEED;
        newDirection = 'right';
        isWalking = true;
      }

      let newVy = p.vy + GRAVITY;
      if (p.onGround && (keysPressed.current['ArrowUp'] || keysPressed.current['w'] || keysPressed.current[' '])) {
        newVy = -JUMP_STRENGTH;
      }
      
      let newX = p.x + newVx;
      let newY = p.y + newVy;
      let onGround = false;
      let newWalkFrame = p.walkFrame;

      // Update walk animation frame
      if (isWalking && p.onGround) {
        walkFrameCounter.current += 1;
        if(walkFrameCounter.current > WALK_ANIMATION_SPEED) {
             newWalkFrame = (p.walkFrame + 1) % 2;
             walkFrameCounter.current = 0;
        }
      } else {
        newWalkFrame = 0;
        walkFrameCounter.current = 0;
      }

      // Collision with platforms
      initialLevel.platforms.forEach(platform => {
        // Check for vertical collision (landing on top)
        if (
          p.x < platform.x + platform.width &&
          p.x + p.width > platform.x &&
          p.y + p.height <= platform.y &&
          newY + p.height >= platform.y
        ) {
          newY = platform.y - p.height;
          newVy = 0;
          onGround = true;
        }

        // Check for horizontal collision
         if (
            newX < platform.x + platform.width &&
            newX + p.width > platform.x &&
            p.y < platform.y + platform.height &&
            p.y + p.height > platform.y &&
             !onGround // prevent sticking to walls when on ground
        ) {
            // This is a simplified horizontal collision, might need improvement
            const playerBottom = p.y + p.height;
            const platformTop = platform.y;
            if(playerBottom > platformTop) { // only if not on top
                if (newVx > 0) { // Moving right
                    newX = platform.x - p.width;
                } else if (newVx < 0) { // Moving left
                    newX = platform.x + platform.width;
                }
            }
        }
      });
      
      // World bounds
      if (newX < 0) newX = 0;

      // Fall off world
      if (newY > BASE_GAME_HEIGHT) {
        setGameState('gameOver');
      }

      return { ...p, x: newX, y: newY, vx: newVx, vy: newVy, onGround, direction: newDirection, isWalking, walkFrame: newWalkFrame };
    });

    // Enemy logic
    setEnemies(prevEnemies => prevEnemies.map(enemy => {
        let newVx = enemy.vx;
        if (enemy.x > enemy.initialX + enemy.range || enemy.x < enemy.initialX) {
          newVx = -enemy.vx;
        }
        return { ...enemy, x: enemy.x + newVx, vx: newVx };
    }));

    // Collision checks
    setPlayer(p => {
      // Coins
      setCoins(prevCoins => prevCoins.map(coin => {
          if (!coin.collected && checkCollision(p, coin)) {
              setScore(s => s + 10);
              return { ...coin, collected: true };
          }
          return coin;
      }));

      // Enemies
      enemies.forEach(enemy => {
        if (checkCollision(p, enemy)) {
           // Check for stomp
           if (p.vy > 0 && p.y + p.height < enemy.y + enemy.height) {
                setEnemies(prev => prev.filter(e => e.id !== enemy.id));
                setScore(s => s + 50);
                // Make player bounce
                 setPlayer(currentPlayer => ({...currentPlayer, vy: -JUMP_STRENGTH / 2}));
            } else {
                setGameState('gameOver');
            }
        }
      });

      // Prince
      if (checkCollision(p, initialLevel.prince)) {
        setGameState('win');
      }

      return p;
    });

    // Update camera
    setCameraX(prev => {
        const target = player.x - (BASE_GAME_WIDTH / 3);
        const newCamX = prev + (target - prev) * 0.1;
        return Math.max(0, newCamX);
    });

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, player.x, enemies]);

  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);
  
  const checkCollision = (obj1: GameObject, obj2: GameObject) => {
    return (
      obj1.x < obj2.x + obj2.width &&
      obj1.x + obj1.width > obj2.x &&
      obj1.y < obj2.y + obj2.height &&
      obj1.y + obj1.height > obj2.y
    );
  };

  const scale = gameDimensions.width / BASE_GAME_WIDTH;

  return (
    <main className="flex flex-col items-center justify-center font-headline bg-background text-foreground min-h-screen h-full p-2 md:p-4 overflow-hidden">
        <header className="shrink-0 w-full text-center">
            <h1 className="text-3xl md:text-4xl font-bold my-2">Pankhu's Quest</h1>
        </header>
        <div 
          className="relative w-full flex-1 flex items-center justify-center"
        >
          <div 
            ref={gameContainerRef}
            style={{ width: gameDimensions.width, height: gameDimensions.height }} 
            className="relative overflow-hidden bg-primary rounded-lg shadow-2xl border-4 border-foreground"
          >
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: BASE_GAME_WIDTH, height: BASE_GAME_HEIGHT }}>
                <AnimatePresence>
                    {gameState !== 'playing' && (
                         <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-20 flex items-center justify-center"
                        >
                           <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
                              <Card className="text-center w-full max-w-xs sm:max-w-sm">
                                <CardHeader>
                                  <CardTitle className="text-2xl sm:text-3xl">
                                    {gameState === 'start' && "Pankhu's Quest"}
                                    {gameState === 'gameOver' && "Game Over"}
                                    {gameState === 'win' && "You Win!"}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3 sm:space-y-4">
                                  {gameState === 'start' && <p className="text-sm sm:text-base">Help Princess Pankhu rescue Prince Karthik!</p>}
                                  {gameState === 'gameOver' && <HeartCrack className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-destructive" />}
                                  {gameState === 'win' && (
                                    <div className="flex flex-col items-center gap-2">
                                        <Award className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-yellow-400" />
                                        <p className="text-sm sm:text-base">You rescued Prince Karthik!</p>
                                        <p className="text-xl sm:text-2xl font-bold">Final Score: {score}</p>
                                    </div>
                                  )}

                                  <Button onClick={resetGame} size="lg">
                                    {gameState === 'start' ? 'Start Game' : 'Play Again'}
                                  </Button>

                                  {gameState === 'start' && (
                                    <div className="text-xs sm:text-sm text-muted-foreground pt-2 sm:pt-4">
                                        <p><strong>Controls:</strong></p>
                                        <p>Arrow Keys / WASD to Move</p>
                                        <p>Space / Up Arrow / W to Jump</p>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                           </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Parallax Background */}
                <div 
                    className="absolute inset-0 bg-repeat-x"
                    style={{
                        backgroundImage: 'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23d2eaf4"/><path d="M 50 0 A 50 50 0 0 1 100 50 L 100 100 L 0 100 L 0 50 A 50 50 0 0 1 50 0" fill="%23a9cce3"/></svg>\')',
                        backgroundPosition: `${-cameraX * 0.1}px 0`,
                        backgroundSize: '400px 400px',
                        opacity: 0.5
                    }}
                />
                 <div 
                    className="absolute inset-0 bg-repeat-x"
                    style={{
                        backgroundImage: 'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="none"/><path d="M-20 150 C 30 100, 70 100, 120 150 S 170 200, 220 150" stroke="%2385c1e9" stroke-width="10" fill="none"/></svg>\')',
                        backgroundPosition: `${-cameraX * 0.3}px 150px`,
                        backgroundSize: '300px 200px',
                        opacity: 0.7
                    }}
                />

                {/* HUD */}
                <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10" style={{transform: `scale(${1/scale})`, transformOrigin: 'top left'}}>
                    <div className="flex items-center gap-2 bg-black/50 text-white p-2 rounded-lg font-bold text-lg sm:text-xl">
                       <Coins className="text-yellow-400 w-5 h-5 sm:w-6 sm:h-6" />
                       <span>{score}</span>
                    </div>
                </div>

                {/* Game World */}
                <div className="relative w-full h-full" style={{ transform: `translateX(-${cameraX}px)`}}>
                    {/* Player */}
                    <div 
                      className="absolute"
                      style={{ 
                        transform: `translate(${player.x}px, ${player.y}px)`,
                        width: player.width, 
                        height: player.height,
                      }}
                    >
                        <div 
                          className="w-full h-full relative" 
                          style={{transform: `scaleX(${player.direction === 'right' ? 1 : -1})`}}
                        >
                           <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded" style={{ transform: `translateX(-50%) scaleX(${player.direction === 'right' ? 1 : -1})` }}>
                                Pankhu
                            </div>
                           <PlayerSprite isWalking={player.isWalking} onGround={player.onGround} walkFrame={player.walkFrame} />
                        </div>
                    </div>

                    {/* Platforms */}
                    {initialLevel.platforms.map(p => (
                      <div key={p.id} className="absolute bg-[#A97C50] border-b-4 border-black/20" style={{ left: p.x, top: p.y, width: p.width, height: p.height }} />
                    ))}

                    {/* Coins */}
                    {coins.map(c => !c.collected && (
                      <div key={c.id} className="absolute coin-spin" style={{ left: c.x, top: c.y, width: c.width, height: c.height, perspective: '1000px' }}>
                         <div className="w-full h-full bg-yellow-400 rounded-full border-2 border-yellow-600 shadow-md"/>
                      </div>
                    ))}
                    
                    {/* Enemies */}
                    {enemies.map(e => (
                       <div key={e.id} className="absolute" style={{ left: e.x, top: e.y, width: e.width, height: e.height }}>
                            <div className="w-full h-full bg-red-600 rounded-md border-2 border-red-800 animate-pulse" />
                       </div>
                    ))}

                    {/* Prince */}
                    <div className="absolute" style={{ left: initialLevel.prince.x, top: initialLevel.prince.y, width: initialLevel.prince.width, height: initialLevel.prince.height }}>
                         <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                Karthik
                         </div>
                        <PrinceSprite />
                    </div>
                </div>
            </div>
          </div>
        </div>
         {/* Mobile Controls */}
        {isMobile && gameState === 'playing' && (
            <div className="fixed bottom-0 left-0 right-0 p-4 flex justify-between items-center z-20 md:hidden">
                <div className="flex gap-4">
                    <Button 
                        size="lg" 
                        className="w-20 h-20 rounded-full opacity-80"
                        onTouchStart={handleTouchStart('ArrowLeft')}
                        onTouchEnd={handleTouchEnd('ArrowLeft')}
                        onMouseDown={handleMouseDown('ArrowLeft')}
                        onMouseUp={handleMouseUp('ArrowLeft')}
                        onMouseLeave={handleMouseUp('ArrowLeft')}
                    >
                        <ArrowLeft className="w-10 h-10"/>
                    </Button>
                    <Button 
                        size="lg" 
                        className="w-20 h-20 rounded-full opacity-80"
                        onTouchStart={handleTouchStart('ArrowRight')}
                        onTouchEnd={handleTouchEnd('ArrowRight')}
                        onMouseDown={handleMouseDown('ArrowRight')}
                        onMouseUp={handleMouseUp('ArrowRight')}
                        onMouseLeave={handleMouseUp('ArrowRight')}
                    >
                        <ArrowRight className="w-10 h-10"/>
                    </Button>
                </div>
                <div >
                    <Button 
                        size="lg" 
                        className="w-24 h-24 rounded-full opacity-80"
                        onTouchStart={handleTouchStart(' ')}
                        onTouchEnd={handleTouchEnd(' ')}
                        onMouseDown={handleMouseDown(' ')}
                        onMouseUp={handleMouseUp(' ')}
                        onMouseLeave={handleMouseUp(' ')}
                    >
                        <ArrowUp className="w-12 h-12" />
                    </Button>
                </div>
            </div>
        )}
    </main>
  );
}

    