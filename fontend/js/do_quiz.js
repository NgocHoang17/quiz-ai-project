// === BIẾN TOÀN CỤC ===
let allQuestions = []; // Mảng chứa tất cả câu hỏi
let userAnswers = {}; // Object lưu câu trả lời của user (ví dụ: {0: 'A', 1: 'C'})
let currentQuestionIndex = 0; // Vị trí câu hỏi hiện tại
let quizId = null;

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

// === CHẠY KHI TẢI TRANG ===
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Kiểm tra đăng nhập (để hiển thị user)
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

    // 2. Lấy quizId từ URL
    const params = new URLSearchParams(window.location.search);
    quizId = params.get('quiz_id');
    if (!quizId) {
        quizErrorElem.innerText = 'Lỗi: Không tìm thấy ID của quiz.';
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
            throw new Error('Không thể tải quiz. Có thể quiz này không tồn tại.');
        }
        
        const quizData = await response.json();
        
        // Lưu dữ liệu
        allQuestions = quizData.questions;
        userAnswers = {}; // Reset câu trả lời
        currentQuestionIndex = 0;
        
        // Cập nhật UI
        quizTitleElem.innerText = quizData.title;
        
        // "Vẽ" câu hỏi đầu tiên
        renderQuestion(currentQuestionIndex);
        updateNavButtons();
        
    } catch (err) {
        quizErrorElem.innerText = err.message;
        quizQuestionsWrapper.style.display = 'none';
    }
}

// === HÀM "VẼ" CÂU HỎI RA MÀN HÌNH ===
function renderQuestion(index) {
    const question = allQuestions[index];
    
    questionTextElem.innerText = `${index + 1}. ${question.question_text}`;
    choicesContainerElem.innerHTML = ''; // Xóa các lựa chọn cũ
    
    // Tạo 4 nút radio cho A, B, C, D
    const choices = [
        { key: 'A', value: question.choice_a },
        { key: 'B', value: question.choice_b },
        { key: 'C', value: question.choice_c },
        { key: 'D', value: question.choice_d }
    ];
    
    choices.forEach(choice => {
        const label = document.createElement('label');
        label.className = 'quiz-choice-label';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `question_${index}`;
        radio.value = choice.key;
        
        // Kiểm tra xem user đã trả lời câu này chưa
        if (userAnswers[index] === choice.key) {
            radio.checked = true;
        }
        
        // Sự kiện khi người dùng chọn đáp án
        radio.addEventListener('change', () => {
            userAnswers[index] = choice.key;
        });
        
        const span = document.createElement('span');
        span.innerText = ` ${choice.key}: ${choice.value}`;
        
        label.appendChild(radio);
        label.appendChild(span);
        choicesContainerElem.appendChild(label);
    });
    
    // Cập nhật bộ đếm
    questionCounterElem.innerText = `Câu ${index + 1} / ${allQuestions.length}`;
}

// === HÀM ĐIỀU HƯỚNG ===
function updateNavButtons() {
    prevButton.disabled = (currentQuestionIndex === 0);
    
    if (currentQuestionIndex === allQuestions.length - 1) {
        // Nếu là câu cuối
        nextButton.style.display = 'none';
        submitButton.style.display = 'block';
    } else {
        // Nếu chưa phải câu cuối
        nextButton.style.display = 'block';
        submitButton.style.display = 'none';
    }
}

function showNextQuestion() {
    if (currentQuestionIndex < allQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion(currentQuestionIndex);
        updateNavButtons();
    }
}

function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion(currentQuestionIndex);
        updateNavButtons();
    }
}

// === HÀM NỘP BÀI VÀ CHẤM ĐIỂM ===
function submitQuiz() {
    // Xác nhận nộp bài
    if (!confirm("Bạn có chắc chắn muốn nộp bài?")) {
        return;
    }
    
    let score = 0;
    
    // 1. Tính điểm
    allQuestions.forEach((question, index) => {
        if (userAnswers[index] === question.correct_answer) {
            score++;
        }
    });
    
    // 2. Ẩn khu vực làm bài, hiện khu vực kết quả
    quizQuestionsWrapper.style.display = 'none';
    quizResultDisplay.style.display = 'block';
    quizScoreElem.innerText = `Bạn đã đúng ${score} / ${allQuestions.length} câu.`;

    // 3. (Nâng cao) Hiển thị lại các câu hỏi với đáp án đúng/sai
    renderResults();
}

// Hàm (nâng cao) hiển thị kết quả chi tiết
function renderResults() {
    allQuestions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'quiz-question mt-3'; // Dùng lại CSS cũ
        
        let choicesHTML = '';
        const choices = [
            { key: 'A', value: question.choice_a },
            { key: 'B', value: question.choice_b },
            { key: 'C', value: question.choice_c },
            { key: 'D', value: question.choice_d }
        ];
        
        const userAnswer = userAnswers[index]; // 'A', 'B', 'C', 'D' hoặc undefined
        const correctAnswer = question.correct_answer; // 'A', 'B', 'C', 'D'

        choices.forEach(choice => {
            let className = '';
            let label = '';
            
            if (choice.key === correctAnswer) {
                // Đây là đáp án đúng
                className = 'correct';
                
            } else if (choice.key === userAnswer) {
                // Đây là đáp án sai mà user chọn
                className = 'incorrect';
                
            }

            choicesHTML += `<li class="${className}">${choice.key}: ${choice.value} <span class="correct-answer-text">${label}</span></li>`;
        });

        questionDiv.innerHTML = `
            <h4>Câu ${index + 1}: ${question.question_text}</h4>
            <ul>${choicesHTML}</ul>
        `;
        
        quizResultDisplay.appendChild(questionDiv);
    });
}