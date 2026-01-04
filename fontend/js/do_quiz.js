let questionsData = [];
let userAnswers = {}; 
let questionStats = {}; 
let timerInterval;
let isSubmitted = false;
let isPracticeMode = false;

document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const quizId = urlParams.get('quiz_id');
    const timeLimit = parseInt(urlParams.get('time')) || 0; 
    const token = localStorage.getItem('quizAIToken');

    if (!quizId || !token) { 
        alert('Lỗi: Không tìm thấy bài thi hoặc chưa đăng nhập.'); 
        window.location.href = 'my_quizzes.html'; 
        return; 
    }

    // Xác định chế độ: Nếu thời gian = 0 thì là Luyện tập
    isPracticeMode = (timeLimit === 0);

    // 1. Tải câu hỏi & Thống kê
    await Promise.all([
        loadQuestions(quizId, token),
        loadQuestionStats(quizId, token)
    ]);
    
    // Render
    renderQuestions(questionsData);
    renderSidebarNav(questionsData.length);

    // 2. Cấu hình Đồng hồ
    setupTimer(timeLimit);

    // 3. Sự kiện Nộp bài
    document.getElementById('submit-btn').addEventListener('click', confirmSubmit);
});

// --- HÀM TIỆN ÍCH TRỘN MẢNG ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function loadQuestions(quizId, token) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/quizzes/${quizId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Không tải được dữ liệu.");
        const data = await response.json();
        
        document.getElementById('quiz-title').innerText = data.title;
        questionsData = data.questions;

        // XỬ LÝ TRỘN CÂU HỎI
        const urlParams = new URLSearchParams(window.location.search);
        const shouldShuffleQ = urlParams.get('shuffle_q') === '1';
        
        if (shouldShuffleQ) {
            questionsData = shuffleArray(questionsData);
        }
    } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra khi tải đề thi.");
    }
}

async function loadQuestionStats(quizId, token) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/my-question-stats/${quizId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const stats = await response.json();
            stats.forEach(s => {
                if (s.is_frequently_wrong) questionStats[s.question_id] = true;
            });
        }
    } catch (err) { console.error("Lỗi tải stats:", err); }
}

function renderQuestions(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';

    // Lấy tùy chọn trộn đáp án
    const urlParams = new URLSearchParams(window.location.search);
    const shouldShuffleA = urlParams.get('shuffle_a') === '1';

    questions.forEach((q, index) => {
        // Chỉ hiện cờ nếu là Luyện tập VÀ câu đó hay sai
        const showFlag = isPracticeMode && questionStats[q.id];
        const flagHtml = showFlag 
            ? `<span class="badge bg-danger ms-2 animate__animated animate__fadeIn"><i class="fa-solid fa-flag me-1"></i>Hay sai</span>` 
            : '';

        // XỬ LÝ TRỘN ĐÁP ÁN
        let optionKeys = ['A', 'B', 'C', 'D'];
        if (shouldShuffleA) {
            optionKeys = shuffleArray(optionKeys); 
        }
        
        const displayLabels = ['A', 'B', 'C', 'D']; // Luôn hiển thị A, B, C, D thẳng hàng
        
        let optionsHtml = '';
        optionKeys.forEach((originalKey, idx) => {
            const visualLabel = displayLabels[idx]; 
            const textContent = q['choice_' + originalKey.toLowerCase()]; 
            optionsHtml += renderOption(index, q.id, visualLabel, originalKey, textContent);
        });

        const html = `
            <div class="question-card p-4" id="question-${index}">
                <div class="d-flex align-items-start mb-3">
                    <span class="q-badge me-2">Câu ${index + 1}</span>
                    ${flagHtml} 
                </div>
                
                <h5 class="fw-bold text-dark mb-4" style="line-height: 1.5;">${escapeHTML(q.question_text)}</h5>

                <div class="options-list d-flex flex-column gap-2 ps-lg-3 ps-0 mb-3">
                    ${optionsHtml}
                </div>

                <div class="result-feedback d-none mt-3" id="feedback-${q.id}">
                    <div class="alert alert-light border-start border-4" id="alert-${q.id}">
                        <h6 class="fw-bold mb-1"><i class="fa-solid fa-check-circle me-1"></i> Đáp án đúng: <span class="text-success fw-bold">${q.correct_answer}</span></h6>
                        <hr class="my-2 opacity-25">
                        <p class="mb-1 small"><strong><i class="fa-solid fa-lightbulb text-warning me-1"></i> Giải thích:</strong> ${escapeHTML(q.explanation)}</p>
                        ${q.citation ? `<p class="mb-0 small text-muted fst-italic"><i class="fa-solid fa-quote-left me-1"></i> "${escapeHTML(q.citation)}"</p>` : ''}
                    </div>
                </div>
            </div>`;
        container.innerHTML += html;
    });
}

function renderOption(index, qId, visualLabel, originalKey, text) {
    // ID input phải dùng originalKey để logic chấm điểm đúng
    return `
        <div>
            <input type="radio" class="btn-check" name="q_${qId}" id="opt_${qId}_${originalKey}" 
                value="${originalKey}" 
                onchange="handleAnswerSelect(${index}, ${qId}, '${originalKey}')">
            <label class="option-label w-100" for="opt_${qId}_${originalKey}" id="label_${qId}_${originalKey}">
                <span class="option-key">${visualLabel}</span>
                <span class="option-text">${escapeHTML(text)}</span>
            </label>
        </div>`;
}

function renderSidebarNav(total) {
    const nav = document.getElementById('question-nav');
    nav.innerHTML = '';
    for (let i = 0; i < total; i++) {
        nav.innerHTML += `<button class="nav-item-btn" id="nav-btn-${i}" onclick="scrollToQuestion(${i})">${i + 1}</button>`;
    }
}

window.handleAnswerSelect = function(index, qId, value) {
    if (isSubmitted) return;
    userAnswers[qId] = value;
    document.getElementById(`nav-btn-${index}`).classList.add('answered');
    updateProgressBar();
};

function updateProgressBar() {
    const answeredCount = Object.keys(userAnswers).length;
    const percent = (answeredCount / questionsData.length) * 100;
    document.getElementById('progress-bar').style.width = `${percent}%`;
}

window.scrollToQuestion = function(index) {
    const element = document.getElementById(`question-${index}`);
    const offset = element.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: offset, behavior: "smooth" });
};

function setupTimer(minutes) {
    const display = document.getElementById('timer-display');
    const box = document.getElementById('timer-box');

    if (minutes === 0) {
        display.innerHTML = "Luyện tập";
        box.classList.add('practice');
        return;
    }

    let timeLeft = minutes * 60;
    timerInterval = setInterval(() => {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        display.innerText = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;

        if (timeLeft < 60) {
            box.classList.remove('practice');
            box.style.backgroundColor = '#fee2e2';
            box.style.color = '#dc3545';
        }
        if (--timeLeft < 0) {
            clearInterval(timerInterval);
            alert("Hết giờ!");
            submitQuiz();
        }
    }, 1000);
}

function confirmSubmit() {
    if (isSubmitted) return;
    const total = questionsData.length;
    const answered = Object.keys(userAnswers).length;
    if (answered < total) { if (!confirm(`Còn ${total - answered} câu chưa làm. Nộp luôn?`)) return; }
    else { if (!confirm("Xác nhận nộp bài?")) return; }
    submitQuiz();
}

async function submitQuiz() {
    isSubmitted = true;
    clearInterval(timerInterval);
    document.getElementById('submit-btn').innerHTML = '<i class="fa-solid fa-check me-2"></i> Đã nộp bài';
    document.getElementById('submit-btn').disabled = true;

    let correctCount = 0;
    const resultsToSend = [];

    questionsData.forEach(q => {
        const userAnswer = userAnswers[q.id];
        const isCorrect = userAnswer === q.correct_answer;
        if (isCorrect) correctCount++;
        resultsToSend.push({ question_id: q.id, is_correct: isCorrect });

        // Hiện giải thích
        document.getElementById(`feedback-${q.id}`).classList.remove('d-none');
        document.getElementById(`feedback-${q.id}`).classList.add('animate__animated', 'animate__fadeIn');
        
        // Đổi màu khung alert
        document.getElementById(`alert-${q.id}`).className = isCorrect ? 'alert alert-success border-start border-4' : 'alert alert-danger border-start border-4';

        // Tô màu options
        ['A', 'B', 'C', 'D'].forEach(opt => {
            const label = document.getElementById(`label_${q.id}_${opt}`);
            if (!label) return;
            label.style.pointerEvents = 'none';
            label.className = 'option-label w-100'; // Reset hover

            if (opt === q.correct_answer) {
                label.style.backgroundColor = '#d1fae5';
                label.style.borderColor = '#10b981';
                label.style.color = '#065f46';
                label.innerHTML += ' <i class="fa-solid fa-check ms-2"></i>';
            } else if (opt === userAnswer && !isCorrect) {
                label.style.backgroundColor = '#fee2e2';
                label.style.borderColor = '#ef4444';
                label.style.color = '#991b1b';
                label.innerHTML += ' <i class="fa-solid fa-xmark ms-2"></i>';
            } else {
                label.style.opacity = '0.5';
            }
        });
    });

    // Hiện Modal Kết quả
    const score = Math.round((correctCount / questionsData.length) * 10);
    document.getElementById('result-score').innerText = `${score}/10`;
    document.getElementById('result-correct').innerText = `${correctCount}/${questionsData.length}`;
    new bootstrap.Modal(document.getElementById('resultModal')).show();

    // Gửi server
    try {
        const token = localStorage.getItem('quizAIToken');
        const quizId = new URLSearchParams(window.location.search).get('quiz_id');
        await fetch(`http://127.0.0.1:8000/submit-quiz/${quizId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(resultsToSend)
        });
    } catch (err) { console.error("Lỗi lưu kết quả:", err); }
}

function escapeHTML(str) { if (!str) return ""; return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m])); }