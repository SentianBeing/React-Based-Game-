"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Coins, HeartCrack } from 'lucide-react';

// Game Constants
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const GRAVITY = 0.5;
const PLAYER_SPEED = 5;
const JUMP_STRENGTH = 12;

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

// Level Data
const initialLevel = {
  platforms: [
    { id: 1, x: 0, y: 550, width: 800, height: 50 },
    { id: 2, x: 900, y: 550, width: 600, height: 50 },
    { id: 3, x: 1600, y: 450, width: 200, height: 20 },
    { id: 4, x: 1900, y: 350, width: 200, height: 20 },
    { id: 5, x: 2200, y: 550, width: 800, height: 50 },
    { id: 6, x: 2500, y: 400, width: 150, height: 20 },
    { id: 7, x: 3100, y: 550, width: 1000, height: 50 },
  ],
  coins: [
    { id: 1, x: 1000, y: 500, width: 25, height: 25, collected: false },
    { id: 2, x: 1650, y: 400, width: 25, height: 25, collected: false },
    { id: 3, x: 1950, y: 300, width: 25, height: 25, collected: false },
    { id: 4, x: 2550, y: 350, width: 25, height: 25, collected: false },
    { id: 5, x: 2800, y: 500, width: 25, height: 25, collected: false },
  ],
  enemies: [
    { id: 1, x: 1100, y: 510, width: 40, height: 40, vx: 1, initialX: 1100, range: 200 },
    { id: 2, x: 2600, y: 510, width: 40, height: 40, vx: -1, initialX: 2600, range: 150 },
  ],
  prince: { id: 1, x: 3800, y: 490, width: 40, height: 60 },
};

const createInitialPlayer = (): Player => ({
  id: 1,
  x: 50,
  y: 0,
  width: 30,
  height: 50,
  vx: 0,
  vy: 0,
  onGround: false,
  direction: 'right',
});

// Game Component
export default function PankhusQuest() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [player, setPlayer] = useState<Player>(createInitialPlayer);
  const [coins, setCoins] = useState<Coin[]>(initialLevel.coins);
  const [enemies, setEnemies] = useState<Enemy[]>(initialLevel.enemies);
  const [score, setScore] = useState(0);
  const [cameraX, setCameraX] = useState(0);

  const keysPressed = useRef<Record<string, boolean>>({});
  const gameLoopRef = useRef<number>();

  const resetGame = useCallback(() => {
    setPlayer(createInitialPlayer());
    setCoins(initialLevel.coins.map(c => ({ ...c, collected: false })));
    setEnemies(initialLevel.enemies);
    setScore(0);
    setCameraX(0);
    setGameState('playing');
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing') return;

    setPlayer(p => {
      let newVx = 0;
      let newDirection = p.direction;
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) {
        newVx = -PLAYER_SPEED;
        newDirection = 'left';
      }
      if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) {
        newVx = PLAYER_SPEED;
        newDirection = 'right';
      }

      let newVy = p.vy + GRAVITY;
      if (p.onGround && (keysPressed.current['ArrowUp'] || keysPressed.current['w'] || keysPressed.current[' '])) {
        newVy = -JUMP_STRENGTH;
      }
      
      let newX = p.x + newVx;
      let newY = p.y + newVy;
      let onGround = false;

      // Collision with platforms
      initialLevel.platforms.forEach(platform => {
        if (
          newX < platform.x + platform.width &&
          newX + p.width > platform.x &&
          p.y + p.height <= platform.y &&
          newY + p.height >= platform.y
        ) {
          newY = platform.y - p.height;
          newVy = 0;
          onGround = true;
        }
      });
      
      // World bounds
      if (newX < 0) newX = 0;

      // Fall off world
      if (newY > GAME_HEIGHT) {
        setGameState('gameOver');
      }

      return { ...p, x: newX, y: newY, vx: newVx, vy: newVy, onGround, direction: newDirection };
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
          setGameState('gameOver');
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
        const target = player.x - GAME_WIDTH / 2;
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

  return (
    <div className="flex flex-col items-center justify-center font-headline bg-background text-foreground p-4">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">Pankhu's Quest</h1>
        <div 
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }} 
          className="relative overflow-hidden bg-primary rounded-lg shadow-2xl border-4 border-foreground"
        >
            <AnimatePresence>
                {gameState !== 'playing' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/70 z-20 flex items-center justify-center"
                    >
                      <Card className="text-center w-80">
                        <CardHeader>
                          <CardTitle className="text-3xl">
                            {gameState === 'start' && "Pankhu's Quest"}
                            {gameState === 'gameOver' && "Game Over"}
                            {gameState === 'win' && "You Win!"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           {gameState === 'start' && <p>Help Princess Pankhu rescue Prince Karthik!</p>}
                           {gameState === 'gameOver' && <HeartCrack className="w-16 h-16 mx-auto text-destructive" />}
                           {gameState === 'win' && (
                            <div className="flex flex-col items-center gap-2">
                                <Award className="w-16 h-16 mx-auto text-yellow-400" />
                                <p>You rescued Prince Karthik!</p>
                                <p className="text-2xl font-bold">Final Score: {score}</p>
                            </div>
                           )}

                           <Button onClick={resetGame} size="lg">
                            {gameState === 'start' ? 'Start Game' : 'Play Again'}
                           </Button>

                           {gameState === 'start' && (
                            <div className="text-sm text-muted-foreground pt-4">
                                <p><strong>Controls:</strong></p>
                                <p>Arrow Keys / WASD to Move</p>
                                <p>Space / Up Arrow / W to Jump</p>
                            </div>
                           )}
                        </CardContent>
                      </Card>
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
                    backgroundPosition: `${-cameraX * 0.3}px 250px`,
                    backgroundSize: '300px 200px',
                    opacity: 0.7
                }}
            />

            {/* HUD */}
            <div className="absolute top-4 left-4 z-10">
                <div className="flex items-center gap-2 bg-black/50 text-white p-2 rounded-lg font-bold text-xl">
                   <Coins className="text-yellow-400" />
                   <span>{score}</span>
                </div>
            </div>

            {/* Game World */}
            <div className="relative w-full h-full">
                {/* Player */}
                <div 
                  className="absolute transition-transform duration-100"
                  style={{ 
                    transform: `translate(${player.x - cameraX}px, ${player.y}px) scaleX(${player.direction === 'right' ? 1 : -1})`,
                    width: player.width, 
                    height: player.height,
                  }}
                >
                    <div style={{width: '100%', height: '100%', position: 'relative'}}>
                        {/* Head */}
                        <div className="absolute" style={{ top: 0, left: '5px', width: '20px', height: '20px', background: '#FFDAB9', borderRadius: '4px' }} /> 
                        {/* Dress */}
                        <div className="absolute" style={{ top: '20px', left: '0px', width: '30px', height: '30px', background: 'black', clipPath: 'polygon(20% 0, 80% 0, 100% 100%, 0% 100%)', borderRadius: '4px' }} />
                    </div>
                </div>

                {/* Platforms */}
                {initialLevel.platforms.map(p => (
                  <div key={p.id} className="absolute bg-[#A97C50] border-b-4 border-black/20" style={{ left: p.x - cameraX, top: p.y, width: p.width, height: p.height }} />
                ))}

                {/* Coins */}
                {coins.map(c => !c.collected && (
                  <div key={c.id} className="absolute coin-spin" style={{ left: c.x - cameraX, top: c.y, width: c.width, height: c.height, perspective: '1000px' }}>
                     <div className="w-full h-full bg-yellow-400 rounded-full border-2 border-yellow-600 shadow-md"/>
                  </div>
                ))}
                
                {/* Enemies */}
                {enemies.map(e => (
                   <div key={e.id} className="absolute" style={{ left: e.x - cameraX, top: e.y, width: e.width, height: e.height }}>
                        <div className="w-full h-full bg-red-600 rounded-md border-2 border-red-800 animate-pulse" />
                   </div>
                ))}

                {/* Prince */}
                <div className="absolute" style={{ left: initialLevel.prince.x - cameraX, top: initialLevel.prince.y, width: initialLevel.prince.width, height: initialLevel.prince.height }}>
                    {/* Crown */}
                    <div className="absolute" style={{ top: 0, left: '5px', width: '30px', height: '15px', background: 'gold', clipPath: 'polygon(0 100%, 20% 0, 50% 50%, 80% 0, 100% 100%)' }} />
                    {/* Head */}
                    <div className="absolute" style={{ top: '15px', left: '10px', width: '20px', height: '20px', background: '#FFDAB9', borderRadius: '4px' }} />
                    {/* Body */}
                    <div className="absolute" style={{ top: '35px', left: '5px', width: '30px', height: '25px', background: '#3498DB', borderRadius: '4px' }} />
                </div>
            </div>
        </div>
    </div>
  );
}
