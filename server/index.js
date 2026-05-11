const path = require("path");

app.use(express.static(
  path.join(process.cwd(), "client/dist")
));

app.get("*", (req, res) => {
  res.sendFile(
    path.join(process.cwd(), "client/dist/index.html")
  );
});

const PORT = process.env.PORT || 3000;

http.listen(PORT, () => {
  console.log("服务器启动", PORT);
});