const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
const port = 3000;

// CORS 미들웨어 적용
app.use(cors());

// 정적 파일 제공
app.use(express.static(path.join(__dirname, "public")));

// index.html 서브하기
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/assets/:filename", (req, res) => {
  const filename = req.params.filename;
  res.sendFile(path.join(__dirname, "assets", filename));
});

app.listen(port, () => {
  console.log(`서버가 http://localhost:${port} 에서 실행 중입니다`);
});
