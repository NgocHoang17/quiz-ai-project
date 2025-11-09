// === BIẾN TOÀN CỤC ===
let allQuestions = []; 
let userAnswers = {}; 
let currentQuestionIndex = 0; 
let quizId = null;
let globalQuestionStats = {}; 
// ✅ Biến mới để lưu tùy chọn
let shouldShuffleQuestions = false;
let shouldShuffleChoices = false;

// === LẤY CÁC PHẦN TỬ DOM ===
const quizTitleElem = document.getElementById('quiz-title');
const questionTextElem = document.getElementById('question-text');
const choicesContainerElem = document.getElementById('choices-container');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const submitButton = document.getElementById('submit-button');
const questionCounterElem = document.getElementById('question-counter');
const quizErrorElem = document.getElementById('quiz-error');
const quizResultDisplay = document.getElementById('quiz-result-display');
const quizQuestionsWrapper = document.getElementById('quiz-questions-wrapper');
const quizScoreElem = document.getElementById('quiz-score');
const userInfoNav = document.getElementById('user-info-nav');
// ❌ Xóa 2 biến công tắc

// === HÀM TIỆN ÍCH: TRỘN MẢNG ===
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// === CHẠY KHI TẢI TRANG ===
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Kiểm tra đăng nhập
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');
    if (token && email) {
        userInfoNav.innerHTML = `
            <span class="navbar-text me-3 text-white">Chào, ${email}</span>
            <button class="btn btn-outline-danger" id="logout-button">Đăng xuất</button>
        `;
        document.getElementById('logout-button').addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'login.html';
        });
    }

    // 2. Lấy quizId và TÙY CHỌN TRỘN từ URL
    const params = new URLSearchParams(window.location.search);
    quizId = params.get('quiz_id');
    // ✅ Đọc tùy chọn từ URL
    shouldShuffleQuestions = params.get('shuffle_q') === 'true';
    shouldShuffleChoices = params.get('shuffle_c') === 'true';

    if (!quizId) {
        quizErrorElem.innerText = 'Lỗi: Không tìm thấy ID của quiz.';
        quizQuestionsWrapper.style.display = 'none';
        return;
    }

    // 3. Tải dữ liệu quiz
    await fetchQuizData(quizId);
    
    // 4. Gắn sự kiện cho các nút
    prevButton.addEventListener('click', showPreviousQuestion);
    nextButton.addEventListener('click', showNextQuestion);
    submitButton.addEventListener('click', submitQuiz);
});

// === HÀM TẢI DỮ LIỆU QUIZ TỪ API ===
async function fetchQuizData(id) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/quiz/${id}`);
        if (!response.ok) {
            throw new Error('Không thể tải quiz. Có thể quiz này không tồn tại hoặc đã bị xóa.');
        }
        
        const quizData = await response.json();
        
        // ✅ === LOGIC TRỘN CÂU HỎI ===
        if (shouldShuffleQuestions) {
            shuffleArray(quizData.questions);
        }
        // ============================
        
        allQuestions = quizData.questions;
        userAnswers = {}; 
        currentQuestionIndex = 0;
        
        quizTitleElem.innerText = escapeHTML(quizData.title);

        if (!allQuestions || allQuestions.length === 0) {
            throw new Error('Bộ quiz này không có câu hỏi nào.');
        }
        
        // LẤY "BỘ NHỚ" (STATS)
        const token = localStorage.getItem('quizAIToken');
        globalQuestionStats = {}; 
        
        if (token) { 
            try {
                const statsResponse = await fetch(`http://127.0.0.1:8000/my-question-stats/${quizId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (statsResponse.ok) {
                    const statsList = await statsResponse.json();
                    statsList.forEach(stat => {
                        if (stat.is_frequently_wrong) {
                            globalQuestionStats[stat.question_id] = true;
                        }
                    });
                }
            } catch (err) {
                console.warn("Không thể tải thống kê câu hỏi:", err);
            }
        }
        
        // "Vẽ" câu hỏi đầu tiên
        renderQuestion(currentQuestionIndex, globalQuestionStats);
        updateNavButtons();
        
    } catch (err) {
        quizErrorElem.innerText = err.message;
        quizTitleElem.style.display = 'none';
        const qContainer = document.getElementById('question-container');
        if (qContainer) qContainer.style.display = 'none';
        const navButtons = document.querySelector('.d-flex.justify-content-between');
        if (navButtons) navButtons.style.display = 'none';
    }
}

// === HÀM "VẼ" CÂU HỎI RA MÀN HÌNH ===
function renderQuestion(index, questionStats) {
    if (!allQuestions[index]) return; 
    
    const question = allQuestions[index];
    
    let flagIcon = ''; 
    if (questionStats && questionStats[question.id]) {
        flagIcon = '<span class="red-flag" title="Đây là câu bạn thường làm sai!"> 🚩 </span>';
    }
    
    questionTextElem.innerHTML = `${index + 1}. ${escapeHTML(question.question_text)} ${flagIcon}`;
    choicesContainerElem.innerHTML = ''; 
    
    let choices = [
        { key: 'A', value: question.choice_a },
        { key: 'B', value: question.choice_b },
        { key: 'C', value: question.choice_c },
        { key: 'D', value: question.choice_d }
    ];

    // ✅ === LOGIC TRỘN ĐÁP ÁN ===
    if (shouldShuffleChoices) {
        shuffleArray(choices);
    }
    // ============================
    
    choices.forEach(choice => {
        const label = document.createElement('label');
        label.className = 'quiz-choice-label';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `question_${index}`;
        radio.value = choice.key; // Quan trọng: Giá trị vẫn là A, B, C, D gốc
        
        if (userAnswers[index] === choice.key) {
            radio.checked = true;
        }
        
        radio.addEventListener('change', () => {
            userAnswers[index] = choice.key;
        });
        
        const span = document.createElement('span');
        span.innerHTML = ` ${escapeHTML(choice.value)}`;
        
        label.appendChild(radio);
        label.appendChild(span);
        choicesContainerElem.appendChild(label);
    });
    
    questionCounterElem.innerText = `Câu ${index + 1} / ${allQuestions.length}`;
}

// === HÀM ĐIỀU HƯỚNG ===
function updateNavButtons() {
    prevButton.disabled = (currentQuestionIndex === 0);
    
    if (currentQuestionIndex === allQuestions.length - 1) {
        nextButton.style.display = 'none';
        submitButton.style.display = 'block';
    } else {
        nextButton.style.display = 'block';
        submitButton.style.display = 'none';
    }
}

function showNextQuestion() {
    if (currentQuestionIndex < allQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion(currentQuestionIndex, globalQuestionStats); 
    }
    updateNavButtons();
}

function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion(currentQuestionIndex, globalQuestionStats); 
    }
    updateNavButtons();
}

// === HÀM NỘP BÀI VÀ CHẤM ĐIỂM ===
async function submitQuiz() {
    if (!confirm("Bạn có chắc chắn muốn nộp bài?")) {
        return;
    }
    
    let score = 0;
    
    allQuestions.forEach((question, index) => {
        if (userAnswers[index] === question.correct_answer) {
            score++;
        }
    });
    
    quizQuestionsWrapper.style.display = 'none';
    quizResultDisplay.style.display = 'block';
    quizScoreElem.innerText = `Bạn đã đúng ${score} / ${allQuestions.length} câu.`;

    // Gửi kết quả về server
    const resultsData = allQuestions.map((question, index) => ({
        question_id: question.id,
        is_correct: (userAnswers[index] === question.correct_answer)
    }));
    const token = localStorage.getItem('quizAIToken');
    
    if (token) { 
        try {
            const response = await fetch(`http://127.0.0.1:8000/submit-quiz/${quizId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(resultsData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Lỗi khi gửi kết quả:", errorData.detail || 'Lỗi không xác định');
            } else {
                const data = await response.json();
                console.log(data.message); 
            }
        } catch (err) {
            console.error("Lỗi kết nối khi gửi kết quả:", err);
        }
    }

    renderResults();
}

// Hàm hiển thị kết quả chi tiết
function renderResults() {
    allQuestions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'quiz-question mt-3'; 
        
        let choicesHTML = '';
        const choices = [
            { key: 'A', value: question.choice_a },
            { key: 'B', value: question.choice_b },
            { key: 'C', value: question.choice_c },
            { key: 'D', value: question.choice_d }
        ];
        
        const userAnswer = userAnswers[index];
        const correctAnswer = question.correct_answer;

        choices.forEach(choice => {
            let className = '';
            let label = '';
            
            if (choice.key === correctAnswer) {
                className = 'correct';
                label = ' (Đáp án đúng)';
            } else if (choice.key === userAnswer) {
                className = 'incorrect';
                label = ' (Bạn chọn)';
            }
            choicesHTML += `<li class="${className}">${choice.key}: ${escapeHTML(choice.value)} <span class="correct-answer-text">${label}</span></li>`;
        });

        questionDiv.innerHTML = `
            <h4>Câu ${index + 1}: ${escapeHTML(question.question_text)}</h4>
            <ul>${choicesHTML}</ul>
        `;
        
        quizResultDisplay.appendChild(questionDiv);
    });
}

// === HÀM TIỆN ÍCH (BẮT BUỘC PHẢI CÓ) ===
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}