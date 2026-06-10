// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И НАСТРОЙКИ ВИКТОРИНЫ ---
let quizData = []; 
let currentQuestionIndex = 0;
let score = 0;
let currentAuthMode = 'login'; // Режимы работы: 'login' или 'reg'

document.addEventListener("DOMContentLoaded", () => {
    // 1. АВТОМАТИЧЕСКАЯ НАВИГАЦИЯ (МЕНЮ)
    const buttons = document.querySelectorAll(".nav-btn");
    const sections = document.querySelectorAll(".page-section");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const targetPage = button.getAttribute("data-target");
            
            // Переключаем активную кнопку меню
            buttons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            
            // Переключаем видимость секций сайта
            sections.forEach(section => {
                section.classList.remove("active");
                if (section.id === targetPage) section.classList.add("active");
            });
        });
    });

    // Проверяем статус входа пользователя и запускаем викторину при загрузке
    checkUserSession();
    initQuiz();
});

// Функция для внутренней навигации по кнопкам из контента
function navigateTo(pageId) {
    const btn = document.querySelector(`[data-target="${pageId}"]`);
    if (btn) btn.click();
}

// --- ЛОГИКА АВТОРИЗАЦИИ И ЛИЧНОГО КАБИНЕТА ---

// Переключение вкладок Вход / Регистрация в интерфейсе
function switchAuthTab(mode) {
    currentAuthMode = mode;
    const loginBtn = document.getElementById("tab-login-btn");
    const regBtn = document.getElementById("tab-reg-btn");
    const submitBtn = document.getElementById("auth-submit-btn");
    document.getElementById("auth-error").innerText = "";

    if (mode === 'login') {
        loginBtn.classList.add("active");
        regBtn.classList.remove("active");
        submitBtn.innerText = "Войти";
    } else {
        regBtn.classList.add("active");
        loginBtn.classList.remove("active");
        submitBtn.innerText = "Зарегистрироваться";
    }
}

// Отправка данных авторизации/регистрации на Node.js сервер
async function handleAuth(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("auth-username").value.trim();
    const passwordInput = document.getElementById("auth-password").value.trim();
    const errorEl = document.getElementById("auth-error");
    const endpoint = currentAuthMode === 'login' ? '/api/login' : '/api/register';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });
        const data = await response.json();

        if (!response.ok || data.success === false) {
            errorEl.innerText = data.message || "Ошибка авторизации.";
            return;
        }

        if (currentAuthMode === 'reg') {
            alert("Регистрация успешна! Теперь выполните вход под своим именем.");
            switchAuthTab('login');
        } else {
            // Сохраняем сессию пользователя в локальную память браузера
            localStorage.setItem("tuva_user", data.username);
            localStorage.setItem("tuva_score", data.high_score);
            checkUserSession();
            initQuiz(); // Перезапускаем викторину для подгрузки контента
        }
    } catch (err) {
        errorEl.innerText = "Ошибка соединения с бэкэнд-сервером.";
    }
}

// Функция управления доступом на основе сессии
function checkUserSession() {
    const savedUser = localStorage.getItem("tuva_user");
    const savedScore = localStorage.getItem("tuva_score") || 0;

    const authBox = document.getElementById("auth-box");
    const profileBox = document.getElementById("user-profile-box");
    const quizContentBox = document.getElementById("quiz-content-box");
    const quizLockNotice = document.getElementById("quiz-lock-notice");

    if (savedUser) {
        // Если авторизован: показываем профиль и открываем тест
        authBox.style.display = "none";
        profileBox.style.display = "block";
        document.getElementById("user-display-name").innerText = savedUser;
        document.getElementById("user-display-score").innerText = savedScore;

        if (quizContentBox) quizContentBox.style.display = "block";
        if (quizLockNotice) quizLockNotice.style.display = "none";
    } else {
        // Если гость: прячем личную информацию и блокируем викторину
        authBox.style.display = "block";
        profileBox.style.display = "none";
        if (quizContentBox) quizContentBox.style.display = "none";
        if (quizLockNotice) quizLockNotice.style.display = "block";
    }
}

// Выход из системы
function handleLogout() {
    localStorage.removeItem("tuva_user");
    localStorage.removeItem("tuva_score");
    checkUserSession();
}
// --- ЛОГИКА АСИНХРОННОЙ ВИКТОРИНЫ ---

// Загрузка вопросов из базы данных SQLite через API
async function initQuiz() {
    const questionEl = document.getElementById("quiz-question");
    const optionsContainer = document.getElementById("quiz-options");
    const nextBtn = document.getElementById("next-btn");

    if (!questionEl || !optionsContainer || !nextBtn) return;

    currentQuestionIndex = 0;
    score = 0;
    nextBtn.style.display = "none";

    try {
        questionEl.innerText = "Загрузка вопросов из базы данных...";
        const response = await fetch('/api/quiz');
        quizData = await response.json();

        if (quizData.length === 0) {
            questionEl.innerText = "В базе данных пока нет вопросов.";
            return;
        }
        showQuestion(); // Показываем первый вопрос
    } catch (error) {
        questionEl.innerText = "Ошибка при обращении к серверу БД.";
    }
}

// Отображение текущего вопроса и обработка клика по ответу
function showQuestion() {
    const questionEl = document.getElementById("quiz-question");
    const optionsContainer = document.getElementById("quiz-options");
    const nextBtn = document.getElementById("next-btn");

    nextBtn.style.display = "none";
    optionsContainer.innerHTML = ""; 

    const currentQuiz = quizData[currentQuestionIndex];
    questionEl.innerText = `${currentQuestionIndex + 1}. ${currentQuiz.question}`;

    // Создаем кнопки для вариантов ответа
    currentQuiz.options.forEach((option, index) => {
        const button = document.createElement("button");
        button.innerText = option;
        button.classList.add("quiz-opt-btn");
        
        button.onclick = () => {
            const allButtons = optionsContainer.querySelectorAll("button");
            allButtons.forEach(btn => btn.disabled = true); // Блокируем выбор после клика

            // Строго проверяем правильность индекса ответа
            if (Number(index) === Number(currentQuiz.correct)) {
                button.style.backgroundColor = "#2ecc71"; // Зеленый — правильно
                button.style.color = "white";
                score++; // Увеличиваем счетчик
            } else {
                button.style.backgroundColor = "#e74c3c"; // Красный — ошибка
                button.style.color = "white";
                // Подсвечиваем верный вариант для подсказки пользователю
                allButtons[currentQuiz.correct].style.backgroundColor = "#2ecc71";
                allButtons[currentQuiz.correct].style.color = "white";
            }
            nextBtn.style.display = "inline-block"; // Показываем кнопку перехода
        };
        optionsContainer.appendChild(button);
    });

    // Обработчик кнопки перехода к следующему вопросу
    nextBtn.onclick = () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < quizData.length) {
            showQuestion();
        } else {
            showResults(); // Если вопросы кончились — показываем итог
        }
    };
}

// Вывод итогов и перезапись максимального рекорда в БД
async function showResults() {
    const questionEl = document.getElementById("quiz-question");
    const optionsContainer = document.getElementById("quiz-options");
    const nextBtn = document.getElementById("next-btn");

    questionEl.innerText = "Викторина завершена!";
    let resultText = `Вы успешно ответили правильно на <strong>${score}</strong> из ${quizData.length} вопросов.`;

    const loggedUser = localStorage.getItem("tuva_user");
    if (loggedUser) {
        try {
            // Отправляем набранные очки на бэкэнд
            const response = await fetch('/api/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: loggedUser, score: score })
            });
            const data = await response.json();
            
            // Синхронизируем локальные рекорды с БД
            localStorage.setItem("tuva_score", data.high_score);
            document.getElementById("user-display-score").innerText = data.high_score;

            if (data.newRecord) {
                resultText += `<br><span style="color: #2ecc71; font-weight: bold;">🎉 Превосходно, вы установили новый рекорд! Результат сохранен.</span>`;
            } else {
                resultText += `<br><span>(Ваш максимальный рекорд: ${data.high_score}).</span>`;
            }
        } catch (err) {
            console.error("Ошибка сохранения очков на сервере");
        }
    }

    optionsContainer.innerHTML = `<p class="quiz-result-text">${resultText}</p>`;
    
    nextBtn.innerText = "Пройти викторину заново";
    nextBtn.style.display = "inline-block";
    nextBtn.onclick = () => {
        nextBtn.innerText = "Следующий вопрос";
        initQuiz();
    };
}

// --- ДАННЫЕ ОПИСАНИЯ ПРАЗДНИКОВ ДЛЯ МОДАЛЬНЫХ ОКНО ---
const holidayDetails = {
    shagaa: {
        title: "Шагаа — Тувинский Новый Год",
        body: "<p>Празднование начинается с первыми лучами солнца. Мужчины совершают обряд «сан салыр» — возжигают костер на возвышенностях. Важнейшая традиция — обряд уважительного приветствия рук <strong>«чолукшууру»</strong>.</p>"
    },
    naadym: {
        title: "Наадым — Праздник Животноводов",
        body: "<p>Исторический съезд кочевников. Включает три главных состязания («игры мужей»): национальную борьбу <strong>Хуреш</strong> с ритуальным танцем орла девиг, конные скачки на длинные степные дистанции и стрельбу из лука.</p>"
    },
    khoomei: {
        title: "День Хоомея",
        body: "<p>Праздник уникального культурного достояния республики. Горловое пение Хоомей позволяет исполнителю извлекать одновременно два или три звука разной высоты. На фестивалях звучат эталонные стили: <i>сыгыт, каргыраа, хоомей, борбаннадыр</i>.</p>"
    },
    day_res: {
        title: "День Республики Тыва — 15 августа",
        body: "<p>Главный государственный праздник региона. 15 августа 1921 года во Все тувинском учредительном хурале (съезде) в местечке Суг-Бажы была провозглашена независимость Тувинской Народной Республики и принята её первая конституция.</p>"
    },
    ak_chem: {
        title: "Ак чем (Белая пища) — Фестиваль молочной продукции",
        body: "<p>Красочный гастрономический праздник, направленный на сохранение кулинарных традиций кочевников. Мастера со всей Тувы соревнуются в приготовлении бышлыка (национального сыра), араки (молочной водки), хойтпака и кумыса.</p>"
    },
    ustuu_khuree: {
        title: "Устуу-Хурээ — Фестиваль Живой Музыки и Веры",
        body: "<p>Уникальный международный фестиваль, проходящий в городе Чадан. Стартовал в 1999 году с целью привлечения внимания к разрушенному одноименному буддийскому храму. Главная фишка фестиваля — идея музыкального братства: здесь на одной сцене звучат классика, джаз, фолк, рок и буддийские песнопения.</p>"
    }
};

// Функция открытия модального окна подробностей
function showHolidayModal(id) {
    const modal = document.getElementById("holiday-modal");
    const title = document.getElementById("modal-title");
    const body = document.getElementById("modal-body");

    if (holidayDetails[id]) {
        title.innerText = holidayDetails[id].title;
        body.innerHTML = holidayDetails[id].body;
        modal.style.display = "flex";
    }
}

// Функция закрытия модального окна
function closeHolidayModal() {
    document.getElementById("holiday-modal").style.display = "none";
}
