const express = require("express");
const path = require("path");

const app = express();

// 静态文件
app.use(
  express.static(
    path.join(process.cwd(), "client/dist")
  )
);

// React/Vite 路由
app.get("*", (req, res) => {
  res.sendFile(
    path.join(
      process.cwd(),
      "client/dist/index.html"
    )
  );
});

// 启动服务器
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("服务器启动:", PORT);
});