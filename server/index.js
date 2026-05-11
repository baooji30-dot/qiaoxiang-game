HEAD
const express = require("express");

const app = express();

const http = require("http").createServer(app);

const io = require("socket.io")(http, {

  cors: {

    origin: "*",

    methods: [
      "GET",
      "POST"
    ]

  },

  transports: [
    "websocket",
    "polling"
  ]

});


// ======================
// 游戏数据
// ======================

let players = [];

let turn = 0;

let currentChapter = 1;

let battle = null;


// ======================
// Boss
// ======================

let boss = {

  name: "海寇首领",

  hp: 180,

  maxHp: 180,

  shield: 30,

  phase: 1,

  immuneDebuff: 3,

  rageTriggered: false,

  status: [],

  skillCooldowns: {

    bleed: 0,

    stun: 0

  }

};


// ======================
// 地图
// ======================

const monsterCells = [
  12,18,26,34,
  44,52,66,74
];

const eliteCells = [
  45,75
];

const goldCells = [
  8,16,28,48,68
];

const trapCells = [
  22,38,58,82
];


// ======================
// 商店
// ======================

const shopItems = [

  {

    name: "侨乡药剂",

    cost: 15,

    effect: "heal"

  },

  {

    name: "海寇短刀",

    cost: 25,

    effect: "attack"

  },

  {

    name: "尖塔上的瞭望",

    cost: 40,

    effect: "tower"

  }

];


// ======================
// 洗牌
// ======================

function shuffle(array) {

  for (
    let i = array.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [array[i], array[j]] =
      [array[j], array[i]];

  }

}


// ======================
// 抽牌
// ======================

function drawCards(player, count = 1) {

  for (
    let i = 0;
    i < count;
    i++
  ) {

    if (
      player.deck.length === 0
    ) {

      player.deck = [
        ...player.discard
      ];

      player.discard = [];

      shuffle(player.deck);

    }

    const card =
      player.deck.shift();

    if (card) {

      player.hand.push(card);

    }

  }

}


// ======================
// 状态系统
// ======================

function applyStatus(
  target,
  type,
  turns,
  damage = 0
) {

  if (!target.status) {

    target.status = [];

  }

  target.status.push({

    type,

    turns,

    damage

  });

}


function processStatus(target) {

  if (!target.status) return;

  target.status.forEach((s) => {

    target.hp -= s.damage;

    io.emit(
      "log",
      `${target.name}受到${s.type}伤害 ${s.damage}`
    );

    s.turns--;

  });

  target.status =
    target.status.filter(
      s => s.turns > 0
    );

}


// ======================
// 玩家连接
// ======================

io.on("connection", (socket) => {

  const player = {

    id: socket.id,

    name: `玩家${players.length + 1}`,

    hp: 100,

    maxHp: 100,

    shield: 10,

    energy: 3,

    maxEnergy: 3,

    gold: 50,

    position: 1,

    letters: 0,

    stunned: false,

    towerWatch: false,

    status: [],

    deck: [

      {

        name: "普通攻击",

        damage: 5,

        cost: 1,

        rarity: "普通"

      },

      {

        name: "燃烧攻击",

        damage: 4,

        cost: 1,

        effect: "burn",

        rarity: "普通"

      },

      {

        name: "流血攻击",

        damage: 3,

        cost: 1,

        effect: "bleed",

        rarity: "普通"

      },

      {

        name: "重击",

        damage: 10,

        cost: 2,

        rarity: "稀有"

      },

      {

        name: "治疗术",

        heal: 10,

        cost: 1,

        rarity: "普通"

      },

      {

        name: "撕裂斩",

        damage: 6,

        cost: 2,

        effect: "tear",

        rarity: "稀有"

      }

    ],

    hand: [],

    discard: []

  };


  shuffle(player.deck);

  drawCards(player, 5);

  players.push(player);


  socket.emit("init", {

    player,

    players,

    boss,

    battle,

    shopItems

  });


  io.emit("update", players);

  io.emit("bossUpdate", boss);

  io.emit("battleUpdate", battle);

  io.emit("turn", players[turn]?.id);


  // ======================
  // 移动
  // ======================

  socket.on("move", (steps) => {

    const p =
      players.find(
        x => x.id === socket.id
      );

    if (!p) return;

    if (
      players[turn]?.id !== socket.id
    ) return;


    processStatus(p);


    if (p.stunned) {

      io.emit(
        "log",
        `${p.name}被晕眩`
      );

      p.stunned = false;

      nextTurn();

      return;

    }


    p.position += steps;

    if (p.position > 100) {

      p.position = 100;

    }


    io.emit(
      "log",
      `${p.name}前进${steps}格`
    );


    // 家书

    if (
      [20,40,60,80,100]
      .includes(p.position)
    ) {

      p.letters++;

      io.emit(
        "log",
        `${p.name}获得家书`
      );

    }


    // 金币

    if (
      goldCells.includes(
        p.position
      )
    ) {

      const gain =
        Math.floor(
          Math.random() * 15
        ) + 5;

      p.gold += gain;

      io.emit(
        "log",
        `${p.name}获得${gain}侨汇`
      );

    }


    // 陷阱

    if (
      trapCells.includes(
        p.position
      )
    ) {

      p.hp -= 5;

      io.emit(
        "log",
        `${p.name}踩中陷阱`
      );

    }


    // 小怪

    if (
      monsterCells.includes(
        p.position
      )
    ) {

      battle = {

        type: "monster",

        enemy: {

          name: "海寇杂兵",

          hp: 35,

          shield: 0,

          attack: 2,

          status: []

        }

      };

      io.emit(
        "log",
        `${p.name}遭遇海寇杂兵`
      );

    }


    // 精英

    if (
      eliteCells.includes(
        p.position
      )
    ) {

      battle = {

        type: "elite",

        enemy: {

          name: "海寇头目",

          hp: 60,

          shield: 10,

          attack: 4,

          status: []

        }

      };

      io.emit(
        "log",
        `${p.name}遭遇精英怪`
      );

    }


    // Boss回合

    bossTurn();


    io.emit("update", players);

    io.emit("battleUpdate", battle);

    nextTurn();

  });


  // ======================
  // 使用卡牌
  // ======================

  socket.on("useCard", (index) => {

    const p =
      players.find(
        x => x.id === socket.id
      );

    if (!p) return;

    const card =
      p.hand[index];

    if (!card) return;


    // 能量不足

    if (
      p.energy < card.cost
    ) {

      io.emit(
        "log",
        `${p.name}能量不足`
      );

      return;

    }


    p.energy -= card.cost;


    // ======================
    // 治疗
    // ======================

    if (card.heal) {

      p.hp += card.heal;

      if (
        p.hp > p.maxHp
      ) {

        p.hp = p.maxHp;

      }

      io.emit(
        "log",
        `${p.name}使用治疗术`
      );

    }


    // ======================
    // 小怪战斗
    // ======================

    else if (battle) {

      const enemy =
        battle.enemy;

      let damage =
        card.damage || 0;


      if (
        enemy.shield > 0
      ) {

        enemy.shield -= damage;

        if (
          enemy.shield < 0
        ) {

          enemy.hp +=
            enemy.shield;

          enemy.shield = 0;

        }

      } else {

        enemy.hp -= damage;

      }


      io.emit(
        "log",
        `${p.name}攻击${enemy.name}`
      );


      if (
        card.effect === "burn"
      ) {

        applyStatus(
          enemy,
          "burn",
          2,
          2
        );

      }

      if (
        card.effect === "bleed"
      ) {

        applyStatus(
          enemy,
          "bleed",
          2,
          2
        );

      }

      if (
        card.effect === "tear"
      ) {

        applyStatus(
          enemy,
          "tear",
          2,
          3
        );

      }


      processStatus(enemy);


      // 敌人反击

      p.hp -= enemy.attack;

      io.emit(
        "log",
        `${enemy.name}反击${enemy.attack}`
      );


      // 精英被动

      if (
        battle.type === "elite"
      ) {

        players.forEach((pl) => {

          pl.hp -= 1;

        });

        io.emit(
          "log",
          `精英怪震慑全体`
        );

      }


      // 怪物死亡

      if (enemy.hp <= 0) {

        const reward =
          battle.type === "elite"
            ? 30
            : 15;

        p.gold += reward;

        io.emit(
          "log",
          `${p.name}击败${enemy.name}`
        );

        battle = null;

      }

    }


    // ======================
    // Boss战
    // ======================

    else {

      let damage =
        card.damage || 0;


      // 二阶段限伤

      if (
        boss.phase === 2
      ) {

        damage =
          Math.min(
            damage,
            12
          );

      }


      // Debuff免疫

      let blocked = false;

      if (
        card.effect &&
        boss.immuneDebuff > 0
      ) {

        boss.immuneDebuff--;

        blocked = true;

        io.emit(
          "log",
          `Boss免疫负面效果`
        );

      }


      // 护盾

      if (
        boss.shield > 0
      ) {

        boss.shield -= damage;

        if (
          boss.shield < 0
        ) {

          boss.hp +=
            boss.shield;

          boss.shield = 0;

        }

      } else {

        boss.hp -= damage;

      }


      // 回盾

      boss.shield += 2;


      // Debuff

      if (!blocked) {

        if (
          card.effect === "burn"
        ) {

          applyStatus(
            boss,
            "burn",
            2,
            2
          );

        }

        if (
          card.effect === "bleed"
        ) {

          applyStatus(
            boss,
            "bleed",
            2,
            2
          );

        }

        if (
          card.effect === "tear"
        ) {

          applyStatus(
            boss,
            "tear",
            2,
            3
          );

        }

      }


      // 连携

      const hasBleed =
        boss.status.find(
          s => s.type === "bleed"
        );

      if (
        hasBleed &&
        card.effect === "burn"
      ) {

        boss.hp -= 8;

        io.emit(
          "log",
          `🔥爆燃连携`
        );

      }


      const hasTear =
        boss.status.find(
          s => s.type === "tear"
        );

      if (
        hasTear &&
        card.name === "重击"
      ) {

        boss.hp -= 10;

        io.emit(
          "log",
          `💥撕裂重击`
        );

      }


      processStatus(boss);


      // 狂暴

      if (
        !boss.rageTriggered &&
        boss.hp <= 50
      ) {

        boss.shield += 60;

        boss.rageTriggered = true;

        io.emit(
          "log",
          `Boss触发绝境护盾`
        );

      }


      // 死亡

      if (boss.hp <= 0) {

        io.emit(
          "gameOver",
          "Boss被击败！"
        );

      }

    }


    // 弃牌

    p.discard.push(card);

    p.hand.splice(index, 1);

    drawCards(p, 1);


    io.emit("update", players);

    io.emit("bossUpdate", boss);

    io.emit("battleUpdate", battle);

  });


  // ======================
  // 商店
  // ======================

  socket.on(
    "buyItem",
    (index) => {

    const p =
      players.find(
        x => x.id === socket.id
      );

    if (!p) return;

    const item =
      shopItems[index];

    if (!item) return;

    if (
      p.gold < item.cost
    ) {

      io.emit(
        "log",
        `${p.name}侨汇不足`
      );

      return;

    }


    p.gold -= item.cost;


    // 药水

    if (
      item.effect === "heal"
    ) {

      p.hp += 20;

      if (
        p.hp > p.maxHp
      ) {

        p.hp = p.maxHp;

      }

    }


    // 武器

    if (
      item.effect === "attack"
    ) {

      p.deck.push({

        name: "海寇斩",

        damage: 10,

        cost: 2,

        rarity: "稀有"

      });

    }


    // 瞭望

    if (
      item.effect === "tower"
    ) {

      p.towerWatch = true;

    }


    io.emit(
      "log",
      `${p.name}购买${item.name}`
    );

    io.emit("update", players);

  });


  // ======================
  // 断开
  // ======================

  socket.on("disconnect", () => {

    players =
      players.filter(
        p => p.id !== socket.id
      );

    io.emit("update", players);

  });

});


// ======================
// Boss回合
// ======================

function bossTurn() {

  processStatus(boss);


  players.forEach((p) => {

    p.hp -= 3;

  });


  io.emit(
    "log",
    `Boss发动海寇斩击`
  );


  // 晕眩

  if (
    boss.skillCooldowns.stun <= 0
  ) {

    const dice =
      Math.floor(
        Math.random() * 6
      ) + 1;

    if (
      [2,3,5]
      .includes(dice)
    ) {

      const target =
        players[
          Math.floor(
            Math.random() *
            players.length
          )
        ];

      if (target) {

        target.stunned = true;

        io.emit(
          "log",
          `${target.name}被晕眩`
        );

      }

    }

    boss.skillCooldowns.stun = 2;

  } else {

    boss.skillCooldowns.stun--;

  }


  // 流血

  if (
    boss.skillCooldowns.bleed <= 0
  ) {

    players.forEach((p) => {

      applyStatus(
        p,
        "bleed",
        2,
        2
      );

    });

    io.emit(
      "log",
      `Boss施加流血`
    );

    boss.skillCooldowns.bleed = 3;

  } else {

    boss.skillCooldowns.bleed--;

  }


  // 死亡检测

  players.forEach((p) => {

    if (p.hp <= 0) {

      p.hp = 0;

      io.emit(
        "log",
        `${p.name}被击倒`
      );

    }

  });

}


// ======================
// 下一回合
// ======================

function nextTurn() {

  players.forEach((p) => {

    p.energy =
      p.maxEnergy;

    drawCards(p, 1);

  });


  turn++;

  if (
    turn >= players.length
  ) {

    turn = 0;

  }


  io.emit(
    "turn",
    players[turn]?.id
  );

}


// ======================
// 启动
// ======================

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
  console.log("服务器启动", PORT);

const express = require("express");

const app = express();

const http = require("http").createServer(app);

const io = require("socket.io")(http, {

  cors: {

    origin: "*",

    methods: [
      "GET",
      "POST"
    ]

  },

  transports: [
    "websocket",
    "polling"
  ]

});


// ======================
// 游戏数据
// ======================

let players = [];

let turn = 0;

let currentChapter = 1;

let battle = null;


// ======================
// Boss
// ======================

let boss = {

  name: "海寇首领",

  hp: 180,

  maxHp: 180,

  shield: 30,

  phase: 1,

  immuneDebuff: 3,

  rageTriggered: false,

  status: [],

  skillCooldowns: {

    bleed: 0,

    stun: 0

  }

};


// ======================
// 地图
// ======================

const monsterCells = [
  12,18,26,34,
  44,52,66,74
];

const eliteCells = [
  45,75
];

const goldCells = [
  8,16,28,48,68
];

const trapCells = [
  22,38,58,82
];


// ======================
// 商店
// ======================

const shopItems = [

  {

    name: "侨乡药剂",

    cost: 15,

    effect: "heal"

  },

  {

    name: "海寇短刀",

    cost: 25,

    effect: "attack"

  },

  {

    name: "尖塔上的瞭望",

    cost: 40,

    effect: "tower"

  }

];


// ======================
// 洗牌
// ======================

function shuffle(array) {

  for (
    let i = array.length - 1;
    i > 0;
    i--
  ) {

    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [array[i], array[j]] =
      [array[j], array[i]];

  }

}


// ======================
// 抽牌
// ======================

function drawCards(player, count = 1) {

  for (
    let i = 0;
    i < count;
    i++
  ) {

    if (
      player.deck.length === 0
    ) {

      player.deck = [
        ...player.discard
      ];

      player.discard = [];

      shuffle(player.deck);

    }

    const card =
      player.deck.shift();

    if (card) {

      player.hand.push(card);

    }

  }

}


// ======================
// 状态系统
// ======================

function applyStatus(
  target,
  type,
  turns,
  damage = 0
) {

  if (!target.status) {

    target.status = [];

  }

  target.status.push({

    type,

    turns,

    damage

  });

}


function processStatus(target) {

  if (!target.status) return;

  target.status.forEach((s) => {

    target.hp -= s.damage;

    io.emit(
      "log",
      `${target.name}受到${s.type}伤害 ${s.damage}`
    );

    s.turns--;

  });

  target.status =
    target.status.filter(
      s => s.turns > 0
    );

}


// ======================
// 玩家连接
// ======================

io.on("connection", (socket) => {

  const player = {

    id: socket.id,

    name: `玩家${players.length + 1}`,

    hp: 100,

    maxHp: 100,

    shield: 10,

    energy: 3,

    maxEnergy: 3,

    gold: 50,

    position: 1,

    letters: 0,

    stunned: false,

    towerWatch: false,

    status: [],

    deck: [

      {

        name: "普通攻击",

        damage: 5,

        cost: 1,

        rarity: "普通"

      },

      {

        name: "燃烧攻击",

        damage: 4,

        cost: 1,

        effect: "burn",

        rarity: "普通"

      },

      {

        name: "流血攻击",

        damage: 3,

        cost: 1,

        effect: "bleed",

        rarity: "普通"

      },

      {

        name: "重击",

        damage: 10,

        cost: 2,

        rarity: "稀有"

      },

      {

        name: "治疗术",

        heal: 10,

        cost: 1,

        rarity: "普通"

      },

      {

        name: "撕裂斩",

        damage: 6,

        cost: 2,

        effect: "tear",

        rarity: "稀有"

      }

    ],

    hand: [],

    discard: []

  };


  shuffle(player.deck);

  drawCards(player, 5);

  players.push(player);


  socket.emit("init", {

    player,

    players,

    boss,

    battle,

    shopItems

  });


  io.emit("update", players);

  io.emit("bossUpdate", boss);

  io.emit("battleUpdate", battle);

  io.emit("turn", players[turn]?.id);


  // ======================
  // 移动
  // ======================

  socket.on("move", (steps) => {

    const p =
      players.find(
        x => x.id === socket.id
      );

    if (!p) return;

    if (
      players[turn]?.id !== socket.id
    ) return;


    processStatus(p);


    if (p.stunned) {

      io.emit(
        "log",
        `${p.name}被晕眩`
      );

      p.stunned = false;

      nextTurn();

      return;

    }


    p.position += steps;

    if (p.position > 100) {

      p.position = 100;

    }


    io.emit(
      "log",
      `${p.name}前进${steps}格`
    );


    // 家书

    if (
      [20,40,60,80,100]
      .includes(p.position)
    ) {

      p.letters++;

      io.emit(
        "log",
        `${p.name}获得家书`
      );

    }


    // 金币

    if (
      goldCells.includes(
        p.position
      )
    ) {

      const gain =
        Math.floor(
          Math.random() * 15
        ) + 5;

      p.gold += gain;

      io.emit(
        "log",
        `${p.name}获得${gain}侨汇`
      );

    }


    // 陷阱

    if (
      trapCells.includes(
        p.position
      )
    ) {

      p.hp -= 5;

      io.emit(
        "log",
        `${p.name}踩中陷阱`
      );

    }


    // 小怪

    if (
      monsterCells.includes(
        p.position
      )
    ) {

      battle = {

        type: "monster",

        enemy: {

          name: "海寇杂兵",

          hp: 35,

          shield: 0,

          attack: 2,

          status: []

        }

      };

      io.emit(
        "log",
        `${p.name}遭遇海寇杂兵`
      );

    }


    // 精英

    if (
      eliteCells.includes(
        p.position
      )
    ) {

      battle = {

        type: "elite",

        enemy: {

          name: "海寇头目",

          hp: 60,

          shield: 10,

          attack: 4,

          status: []

        }

      };

      io.emit(
        "log",
        `${p.name}遭遇精英怪`
      );

    }


    // Boss回合

    bossTurn();


    io.emit("update", players);

    io.emit("battleUpdate", battle);

    nextTurn();

  });


  // ======================
  // 使用卡牌
  // ======================

  socket.on("useCard", (index) => {

    const p =
      players.find(
        x => x.id === socket.id
      );

    if (!p) return;

    const card =
      p.hand[index];

    if (!card) return;


    // 能量不足

    if (
      p.energy < card.cost
    ) {

      io.emit(
        "log",
        `${p.name}能量不足`
      );

      return;

    }


    p.energy -= card.cost;


    // ======================
    // 治疗
    // ======================

    if (card.heal) {

      p.hp += card.heal;

      if (
        p.hp > p.maxHp
      ) {

        p.hp = p.maxHp;

      }

      io.emit(
        "log",
        `${p.name}使用治疗术`
      );

    }


    // ======================
    // 小怪战斗
    // ======================

    else if (battle) {

      const enemy =
        battle.enemy;

      let damage =
        card.damage || 0;


      if (
        enemy.shield > 0
      ) {

        enemy.shield -= damage;

        if (
          enemy.shield < 0
        ) {

          enemy.hp +=
            enemy.shield;

          enemy.shield = 0;

        }

      } else {

        enemy.hp -= damage;

      }


      io.emit(
        "log",
        `${p.name}攻击${enemy.name}`
      );


      if (
        card.effect === "burn"
      ) {

        applyStatus(
          enemy,
          "burn",
          2,
          2
        );

      }

      if (
        card.effect === "bleed"
      ) {

        applyStatus(
          enemy,
          "bleed",
          2,
          2
        );

      }

      if (
        card.effect === "tear"
      ) {

        applyStatus(
          enemy,
          "tear",
          2,
          3
        );

      }


      processStatus(enemy);


      // 敌人反击

      p.hp -= enemy.attack;

      io.emit(
        "log",
        `${enemy.name}反击${enemy.attack}`
      );


      // 精英被动

      if (
        battle.type === "elite"
      ) {

        players.forEach((pl) => {

          pl.hp -= 1;

        });

        io.emit(
          "log",
          `精英怪震慑全体`
        );

      }


      // 怪物死亡

      if (enemy.hp <= 0) {

        const reward =
          battle.type === "elite"
            ? 30
            : 15;

        p.gold += reward;

        io.emit(
          "log",
          `${p.name}击败${enemy.name}`
        );

        battle = null;

      }

    }


    // ======================
    // Boss战
    // ======================

    else {

      let damage =
        card.damage || 0;


      // 二阶段限伤

      if (
        boss.phase === 2
      ) {

        damage =
          Math.min(
            damage,
            12
          );

      }


      // Debuff免疫

      let blocked = false;

      if (
        card.effect &&
        boss.immuneDebuff > 0
      ) {

        boss.immuneDebuff--;

        blocked = true;

        io.emit(
          "log",
          `Boss免疫负面效果`
        );

      }


      // 护盾

      if (
        boss.shield > 0
      ) {

        boss.shield -= damage;

        if (
          boss.shield < 0
        ) {

          boss.hp +=
            boss.shield;

          boss.shield = 0;

        }

      } else {

        boss.hp -= damage;

      }


      // 回盾

      boss.shield += 2;


      // Debuff

      if (!blocked) {

        if (
          card.effect === "burn"
        ) {

          applyStatus(
            boss,
            "burn",
            2,
            2
          );

        }

        if (
          card.effect === "bleed"
        ) {

          applyStatus(
            boss,
            "bleed",
            2,
            2
          );

        }

        if (
          card.effect === "tear"
        ) {

          applyStatus(
            boss,
            "tear",
            2,
            3
          );

        }

      }


      // 连携

      const hasBleed =
        boss.status.find(
          s => s.type === "bleed"
        );

      if (
        hasBleed &&
        card.effect === "burn"
      ) {

        boss.hp -= 8;

        io.emit(
          "log",
          `🔥爆燃连携`
        );

      }


      const hasTear =
        boss.status.find(
          s => s.type === "tear"
        );

      if (
        hasTear &&
        card.name === "重击"
      ) {

        boss.hp -= 10;

        io.emit(
          "log",
          `💥撕裂重击`
        );

      }


      processStatus(boss);


      // 狂暴

      if (
        !boss.rageTriggered &&
        boss.hp <= 50
      ) {

        boss.shield += 60;

        boss.rageTriggered = true;

        io.emit(
          "log",
          `Boss触发绝境护盾`
        );

      }


      // 死亡

      if (boss.hp <= 0) {

        io.emit(
          "gameOver",
          "Boss被击败！"
        );

      }

    }


    // 弃牌

    p.discard.push(card);

    p.hand.splice(index, 1);

    drawCards(p, 1);


    io.emit("update", players);

    io.emit("bossUpdate", boss);

    io.emit("battleUpdate", battle);

  });


  // ======================
  // 商店
  // ======================

  socket.on(
    "buyItem",
    (index) => {

    const p =
      players.find(
        x => x.id === socket.id
      );

    if (!p) return;

    const item =
      shopItems[index];

    if (!item) return;

    if (
      p.gold < item.cost
    ) {

      io.emit(
        "log",
        `${p.name}侨汇不足`
      );

      return;

    }


    p.gold -= item.cost;


    // 药水

    if (
      item.effect === "heal"
    ) {

      p.hp += 20;

      if (
        p.hp > p.maxHp
      ) {

        p.hp = p.maxHp;

      }

    }


    // 武器

    if (
      item.effect === "attack"
    ) {

      p.deck.push({

        name: "海寇斩",

        damage: 10,

        cost: 2,

        rarity: "稀有"

      });

    }


    // 瞭望

    if (
      item.effect === "tower"
    ) {

      p.towerWatch = true;

    }


    io.emit(
      "log",
      `${p.name}购买${item.name}`
    );

    io.emit("update", players);

  });


  // ======================
  // 断开
  // ======================

  socket.on("disconnect", () => {

    players =
      players.filter(
        p => p.id !== socket.id
      );

    io.emit("update", players);

  });

});


// ======================
// Boss回合
// ======================

function bossTurn() {

  processStatus(boss);


  players.forEach((p) => {

    p.hp -= 3;

  });


  io.emit(
    "log",
    `Boss发动海寇斩击`
  );


  // 晕眩

  if (
    boss.skillCooldowns.stun <= 0
  ) {

    const dice =
      Math.floor(
        Math.random() * 6
      ) + 1;

    if (
      [2,3,5]
      .includes(dice)
    ) {

      const target =
        players[
          Math.floor(
            Math.random() *
            players.length
          )
        ];

      if (target) {

        target.stunned = true;

        io.emit(
          "log",
          `${target.name}被晕眩`
        );

      }

    }

    boss.skillCooldowns.stun = 2;

  } else {

    boss.skillCooldowns.stun--;

  }


  // 流血

  if (
    boss.skillCooldowns.bleed <= 0
  ) {

    players.forEach((p) => {

      applyStatus(
        p,
        "bleed",
        2,
        2
      );

    });

    io.emit(
      "log",
      `Boss施加流血`
    );

    boss.skillCooldowns.bleed = 3;

  } else {

    boss.skillCooldowns.bleed--;

  }


  // 死亡检测

  players.forEach((p) => {

    if (p.hp <= 0) {

      p.hp = 0;

      io.emit(
        "log",
        `${p.name}被击倒`
      );

    }

  });

}


// ======================
// 下一回合
// ======================

function nextTurn() {

  players.forEach((p) => {

    p.energy =
      p.maxEnergy;

    drawCards(p, 1);

  });


  turn++;

  if (
    turn >= players.length
  ) {

    turn = 0;

  }


  io.emit(
    "turn",
    players[turn]?.id
  );

}


// ======================
// 启动
// ======================

http.listen(3000, () => {

  console.log(
    "服务器启动 3000"
  );

});
import path from "path";
import express from "express";

const app = express();

app.use(express.static(
  path.join(process.cwd(), "client/dist")
));

app.get("*", (req, res) => {
  res.sendFile(
    path.join(process.cwd(), "client/dist/index.html")
  );
});