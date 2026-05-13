import React, { useEffect, useState } from "react";
import io from "socket.io-client";

// ======================
// 后端地址
// ======================

const socket = io(
  "https://qiaoxiang-game.onrender.com",
  {
    transports: [
      "websocket",
      "polling"
    ]
  }
);

// ======================
// 地图格子
// ======================

const SHOP_CELLS = [
  10, 30, 50, 70, 90
];

const LETTER_CELLS = [
  20, 40, 60, 80, 100
];

const MONSTER_CELLS = [
  12, 18, 26, 34,
  44, 52, 66, 74
];

const ELITE_CELLS = [
  45, 75
];

const GOLD_CELLS = [
  8, 16, 28, 48, 68
];

const TRAP_CELLS = [
  22, 38, 58, 82
];

// ======================
// 主程序
// ======================

export default function App() {

  const [players, setPlayers] =
    useState([]);

  const [player, setPlayer] =
    useState(null);

  const [boss, setBoss] =
    useState(null);

  const [battle, setBattle] =
    useState(null);

  const [logs, setLogs] =
    useState([]);

  const [shopItems, setShopItems] =
    useState([]);

  const [currentTurn, setCurrentTurn] =
    useState("");

  const [gameOver, setGameOver] =
    useState("");

  // ======================
  // socket
  // ======================

  useEffect(() => {

    socket.on("init", (data) => {

      console.log("INIT DATA", data);

      setPlayers(data.players);

      setPlayer(data.player);

      setBoss(data.boss);

      setBattle(data.battle);

      setShopItems(data.shopItems);

    });

    socket.on("update", (players) => {

      setPlayers(players);

      const me =
        players.find(
          p => p.id === socket.id
        );

      if (me) {

        setPlayer(me);

      }

    });

    socket.on("bossUpdate", (boss) => {

      setBoss(boss);

    });

    socket.on(
      "battleUpdate",
      (battle) => {

        setBattle(battle);

      }
    );

    socket.on("log", (msg) => {

      setLogs(prev => [
        msg,
        ...prev
      ]);

    });

    socket.on("turn", (id) => {

      setCurrentTurn(id);

    });

    socket.on("gameOver", (msg) => {

      setGameOver(msg);

    });

    return () => {

      socket.off();

    };

  }, []);

  // ======================
  // 掷骰子
  // ======================

  const rollDice = () => {

    const dice =
      Math.floor(
        Math.random() * 6
      ) + 1;

    socket.emit(
      "move",
      dice
    );

  };

  // ======================
  // 用卡
  // ======================

  const useCard = (index) => {

    socket.emit(
      "useCard",
      index
    );

  };

  // ======================
  // 买东西
  // ======================

  const buyItem = (index) => {

    socket.emit(
      "buyItem",
      index
    );

  };

  // ======================
  // 状态图标
  // ======================

  const renderStatus = (status) => {

    if (!status) return null;

    return status.map((s, i) => {

      let icon = "❓";

      if (s.type === "burn")
        icon = "🔥";

      if (s.type === "bleed")
        icon = "🩸";

      if (s.type === "poison")
        icon = "☠️";

      if (s.type === "tear")
        icon = "💢";

      return (

        <div
          key={i}
          style={{
            marginRight: 8,
            fontSize: 20
          }}
        >
          {icon}
          {s.turns}
        </div>

      );

    });

  };

  const isMyTurn =
    player &&
    currentTurn === player.id;

  // ======================
  // UI
  // ======================

  return (

    <div
      style={{
        minHeight: "100vh",
        background: "#efe6d6",
        padding: 20,
        fontFamily: "sans-serif"
      }}
    >

      {/* 标题 */}

      <div
        style={{
          textAlign: "center",
          marginBottom: 20
        }}
      >

        <h1
          style={{
            fontSize: 42,
            margin: 0
          }}
        >
          桥乡桌游：归乡
        </h1>

        <p>
          联机策略卡牌桌游
        </p>

      </div>

      {/* 游戏结束 */}

      {gameOver && (

        <div
          style={{
            background: "#ffebee",
            border: "4px solid red",
            padding: 20,
            borderRadius: 20,
            marginBottom: 20,
            textAlign: "center"
          }}
        >

          <h2>
            {gameOver}
          </h2>

        </div>

      )}

      {/* 玩家 + Boss */}

      <div
        style={{
          display: "flex",
          gap: 20,
          marginBottom: 20
        }}
      >

        {/* 玩家 */}

        <div
          style={{
            flex: 1,
            background: "white",
            borderRadius: 20,
            padding: 20
          }}
        >

          <h2>
            玩家状态
          </h2>

          {player && (

            <>

              <p>
                名称：
                {player.name}
              </p>

              <p>
                HP：
                {player.hp}
                /
                {player.maxHp}
              </p>

              <p>
                护盾：
                {player.shield}
              </p>

              <p>
                能量：
                {player.energy}
                /
                {player.maxEnergy}
              </p>

              <p>
                侨汇：
                {player.gold}
              </p>

              <p>
                位置：
                {player.position}
              </p>

              <p>
                家书：
                {player.letters}
              </p>

              <p>
                卡库：
                {player.deck?.length}
              </p>

              <p>
                弃牌：
                {player.discard?.length}
              </p>

              <div
                style={{
                  display: "flex",
                  marginTop: 10
                }}
              >

                {renderStatus(
                  player.status
                )}

              </div>

              {player.stunned && (

                <div
                  style={{
                    marginTop: 10,
                    color: "red"
                  }}
                >
                  😵 已晕眩
                </div>

              )}

              <div
                style={{
                  marginTop: 15,
                  fontWeight: "bold"
                }}
              >

                {isMyTurn
                  ? "✅ 你的回合"
                  : "⏳ 等待其他玩家"}

              </div>

              <button
                disabled={!isMyTurn}
                onClick={rollDice}
                style={{
                  marginTop: 20,
                  padding: "12px 24px",
                  fontSize: 18,
                  borderRadius: 12
                }}
              >
                🎲 掷骰子
              </button>

            </>

          )}

        </div>

        {/* Boss */}

        <div
          style={{
            width: 420,
            background: "#212121",
            color: "white",
            borderRadius: 20,
            padding: 20
          }}
        >

          {boss && (

            <>

              <h2>
                👹 {boss.name}
              </h2>

              <p>
                阶段：
                {boss.phase}
              </p>

              <p>
                Debuff免疫：
                {boss.immuneDebuff}
              </p>

              <div
                style={{
                  marginTop: 10
                }}
              >

                <div>
                  HP：
                  {boss.hp}
                  /
                  {boss.maxHp}
                </div>

                <div
                  style={{
                    width: "100%",
                    height: 24,
                    background: "#555",
                    borderRadius: 20,
                    overflow: "hidden"
                  }}
                >

                  <div
                    style={{
                      width:
                        `${(boss.hp / boss.maxHp) * 100}%`,
                      height: "100%",
                      background: "#ef5350"
                    }}
                  />

                </div>

              </div>

            </>

          )}

        </div>

      </div>

      {/* 地图 */}

      <div
        style={{
          background: "white",
          borderRadius: 20,
          padding: 20,
          marginBottom: 20
        }}
      >

        <h2>
          归乡地图
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(10, 70px)",
            gap: 6,
            justifyContent:
              "center"
          }}
        >

          {Array.from({
            length: 100
          }).map((_, i) => {

            const pos = i + 1;

            const here =
              players.find(
                p =>
                  p.position === pos
              );

            let bg = "#fff";

            if (
              SHOP_CELLS.includes(pos)
            )
              bg = "#ffe082";

            if (
              LETTER_CELLS.includes(pos)
            )
              bg = "#90caf9";

            if (
              MONSTER_CELLS.includes(pos)
            )
              bg = "#ffccbc";

            if (
              ELITE_CELLS.includes(pos)
            )
              bg = "#ce93d8";

            if (
              GOLD_CELLS.includes(pos)
            )
              bg = "#fff176";

            if (
              TRAP_CELLS.includes(pos)
            )
              bg = "#ef9a9a";

            if (pos >= 95)
              bg = "#ef5350";

            return (

              <div
                key={i}
                style={{
                  width: 70,
                  height: 70,
                  border:
                    "2px solid #333",
                  borderRadius: 16,
                  background: bg,
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  flexDirection:
                    "column",
                  position:
                    "relative"
                }}
              >

                <div>
                  {pos}
                </div>

                {SHOP_CELLS.includes(pos)
                  &&
                  <div>🏪</div>
                }

                {LETTER_CELLS.includes(pos)
                  &&
                  <div>✉️</div>
                }

                {MONSTER_CELLS.includes(pos)
                  &&
                  <div>👾</div>
                }

                {ELITE_CELLS.includes(pos)
                  &&
                  <div>💀</div>
                }

                {GOLD_CELLS.includes(pos)
                  &&
                  <div>💰</div>
                }

                {TRAP_CELLS.includes(pos)
                  &&
                  <div>🪤</div>
                }

                {pos >= 95 &&
                  <div>👹</div>
                }

                {here && (

                  <div
                    style={{
                      position:
                        "absolute",
                      bottom: 4,
                      right: 4
                    }}
                  >
                    🟢
                  </div>

                )}

              </div>

            );

          })}

        </div>

      </div>

    </div>

  );

}