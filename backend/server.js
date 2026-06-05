const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Отдаём статику frontend при деплое
app.use(express.static(path.join(__dirname, '../frontend')));

const keys = require('./keys.json');
const chapters = require('./chapters.json');

// GET /chapters — список глав БЕЗ текста (только мета-данные)
app.get('/chapters', (req, res) => {
  const safe = {};
  Object.entries(chapters).forEach(([id, ch]) => {
    safe[id] = {
      title: ch.title,
      subtitle: ch.subtitle,
      image: ch.image
      // text намеренно скрыт до разблокировки
    };
  });
  res.json(safe);
});

// POST /unlock — проверить ключ и вернуть содержимое главы
app.post('/unlock', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ success: false, message: 'Ключ не передан' });

  const chapterId = keys[key.toUpperCase()];
  if (chapterId && chapters[chapterId]) {
    res.json({ success: true, chapterId, chapter: chapters[chapterId] });
  } else {
    res.status(403).json({ success: false, message: 'Неверный ключ' });
  }
});

app.listen(PORT, () => {
  console.log(`✦ Сервер запущен на http://localhost:${PORT}`);
});
