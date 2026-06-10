const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- ПОДКЛЮЧЕНИЕ БАЗЫ ДАННЫХ ---
const db = new sqlite3.Database('./tuva_culture.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
    } else {
        console.log('Успешное подключение к базе данных SQLite.');
        initDatabase();
    }
});

function initDatabase() {
    // 1. Таблица вопросов
    db.run(`CREATE TABLE IF NOT EXISTS quiz_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        options TEXT NOT NULL,
        correct_index INTEGER NOT NULL
    )`, (err) => {
        if (!err) {
            // Очищаем старое, чтобы записать ровно 12 вопросов
            db.run("DELETE FROM quiz_questions", () => {
                const stmt = db.prepare("INSERT INTO quiz_questions (question, options, correct_index) VALUES (?, ?, ?)");
                
                // 1-2. Шагаа
                stmt.run("Как называется тувинский Новый год по лунно-солнечному календарю?", "Наадым;Шагаа;Устуу-Хурээ;День Хоомея", 1);
                stmt.run("Какой традиционный обряд приветствия руками совершается во время Шагаа?", "Девиг;Чолукшууру;Сан салыр;Кара-дег", 1);
                
                // 3-4. Наадым
                stmt.run("Какой вид спорта сопровождается ритуальным танцем орла («девиг») на празднике Наадым?", "Стрельба из лука;Конные скачки;Национальная борьба Хуреш;Шахматы", 2);
                stmt.run("Какие три состязания традиционно входят в программу праздника Наадым?", "Борьба Хуреш, конные скачки и стрельба из лука;Шахматы, бег и поднятие камней;Гонки на лодках, прыжки и борьба;Армрестлинг, стрельба и плавание", 0);
                
                // 5-6. День Хоомея
                stmt.run("Что такое Хоомей, дню которого посвящен праздник 17 августа?", "Традиционный тувинский костюм;Национальное горловое пение;Вид степного музыкального инструмента;Обряд кочевников", 1);
                stmt.run("Какой из перечисленных стилей НЕ относится к тувинскому горловому пению хоомей?", "Сыгыт;Каргыраа;Борбаннадыр;Узун-куй", 3);
                
                // 7-8. День Республики
                stmt.run("В каком году на учредительном хурале была провозглашена независимость Тувинской Народной Республики?", "1914 год;1921 год;1944 год;1991 год", 1);
                stmt.run("Какого числа ежегодно отмечается День Республики Тыва?", "1 января;9 мая;15 августа;17 августа", 2);
                
                // 9-10. Ак чем
                stmt.run("Чему посвящен национальный фестиваль «Ак чем», проходящий в августе?", "Конным скачкам;Выставке традиционной одежды;Фестивалю молочной продукции;Конкурсу кузнецов", 2);
                stmt.run("Какое традиционное блюдо или напиток кочевников презентуют мастера на фестивале Ак чем?", "Быштак (сыр) и хойтпак;Пресный пшеничный хлеб;Жареный картофель;Красный виноградный сок", 0);
                
                // 11-12. Устуу-Хурээ (НОВОЕ!)
                stmt.run("В каком городе Республики Тыва ежегодно проводится Международный фестиваль живой музыки и веры «Устуу-Хурээ»?", "Кызыл;Чадан;Шагонар;Туран", 1);
                stmt.run("Какова главная историческая идея и цель создания фестиваля «Устуу-Хурээ»?", "Проведение спортивных гонок;Восстановление разрушенного одноименного буддийского храма;Конкурс поваров;Выставка современной живописи", 1);

                stmt.finalize();
                console.log("12 обновленных вопросов успешно загружены!");
            });
        }
    });

    // 2. Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        high_score INTEGER DEFAULT 0
    )`);
}

// --- API ЭНДПОИНТЫ ---
app.get('/api/quiz', (req, res) => {
    db.all("SELECT * FROM quiz_questions", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const formattedQuestions = rows.map(row => ({
            id: row.id,
            question: row.question,
            options: row.options.split(';'),
            correct: parseInt(row.correct_index, 10) // Принудительно превращаем в число
        }));
        res.json(formattedQuestions);
    });
});

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: "Заполните fields" });
    db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, password], function(err) {
        if (err) {
            if (err.message.includes("UNIQUE")) return res.status(400).json({ success: false, message: "Имя занято!" });
            return res.status(500).json({ success: false, message: err.message });
        }
        res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err) return res.status(500).json({ success: false });
        if (!user) return res.status(400).json({ success: false, message: "Неверный логин или пароль!" });
        res.json({ success: true, username: user.username, high_score: user.high_score });
    });
});

app.post('/api/score', (req, res) => {
    const { username, score } = req.body;
    db.get("SELECT high_score FROM users WHERE username = ?", [username], (err, row) => {
        const currentScore = parseInt(score, 10);
        if (row && currentScore > row.high_score) {
            db.run("UPDATE users SET high_score = ? WHERE username = ?", [currentScore, username], (err) => {
                res.json({ success: true, newRecord: true, high_score: currentScore });
            });
        } else {
            res.json({ success: true, newRecord: false, high_score: row ? row.high_score : 0 });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Сервер: http://localhost:${PORT}`);
});
