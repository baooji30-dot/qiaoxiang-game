import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);


// ======================
// 静态前端
// ======================

app.use(
  express.static(
    path.join(
      __dirname,
      "../client/dist"
    )
  )
);

app.get("*", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "../client/dist/index.html"
    )
  );

});


// ======================
// 游戏数据
// ======================

let players = [];

const boss = {
  name: "归乡魔神",
  hp: 300,
  maxHp: 300,
  shield: 0,
  phase: 1,
  immuneDebuff: false,
  status: []
};

const shopItems = [
  {
    name: "治疗药",
    cost: 20
  },
  {
    name: "铁剑",
    cost: 50
  }
];


// ======================
// socket
// ======================

io.on("connection", (socket) => {

  console.log("玩家连接", socket.id);

  const player = {
    id: socket.id,
    name: "玩家",
    hp: 100,
    maxHp: 100,
    shield: 0,
    energy: 3,
    maxEnergy: 3,
    gold: 50,
    position: 1,
    letters: 0,
    deck: [],
    discard: [],
    hand: [
      {
        name: "普通攻击",
        rarity: "普通",
        cost: 1,
        damage: 10
      }
    ],
    status: []
  };

  players.push(player);

  socket.emit("init", {
    players,
    player,
    boss,
    battle: null,
    shopItems
  });

  io.emit("update", players);

  socket.on("move", (dice) => {

    const me =
      players.find(
        p => p.id === socket.id
      );

    if (!me) return;

    me.position += dice;

    if (me.position > 100) {
      me.position = 100;
    }

    io.emit("update", players);

    io.emit(
      "log",
      `${me.name} 掷出了 ${dice}`
    );

  });

  socket.on("buyItem", (index) => {

    const me =
      players.find(
        p => p.id === socket.id
      );

    const item =
      shopItems[index];

    if (!me || !item) return;

    if (me.gold >= item.cost) {

      me.gold -= item.cost;

      io.emit(
        "log",
        `${me.name} 购买了 ${item.name}`
      );

      io.emit("update", players);

    }

  });

  socket.on("useCard", (index) => {

    const me =
      players.find(
        p => p.id === socket.id
      );

    if (!me) return;

    const card =
      me.hand[index];

    if (!card) return;

    boss.hp -= card.damage || 0;

    if (boss.hp < 0) {
      boss.hp = 0;
    }

    io.emit(
      "bossUpdate",
      boss
    );

    io.emit(
      "log",
      `${me.name} 使用了 ${card.name}`
    );

  });

  socket.on("disconnect", () => {

    players =
      players.filter(
        p => p.id !== socket.id
      );

    io.emit("update", players);

    console.log(
      "玩家离开",
      socket.id
    );

  });

});


// ======================
// 启动
// ======================

const PORT =
  process.env.PORT || 10000;

server.listen(PORT, () => {

  console.log(
    "服务器启动:",
    PORT
  );

});