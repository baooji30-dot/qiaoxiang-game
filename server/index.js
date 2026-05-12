const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

let players = [];

io.on("connection", (socket) => {
  console.log("玩家连接:", socket.id);

  const player = {
    id: socket.id,
    hp: 100,
    x: 0,
    y: 0
  };

  players.push(player);

  io.emit("players", players);

  socket.on("move", (data) => {
    const p = players.find(v => v.id === socket.id);

    if (!p) return;

    p.x = data.x;
    p.y = data.y;

    io.emit("players", players);
  });

  socket.on("disconnect", () => {
    players = players.filter(v => v.id !== socket.id);

    io.emit("players", players);

    console.log("玩家离开:", socket.id);
  });
});

app.use(express.static(
  path.join(__dirname, "../client/dist")
));

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../client/dist/index.html")
  );
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("服务器启动:", PORT);
});