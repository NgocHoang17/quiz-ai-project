let allQuestions = [];
let currentIndex = 0;
const flashcard = document.getElementById('flashcard');
const frontContent = document.getElementById('card-front-content');
const backContent = document.getElementById('card-back-content');
const quizTitleElem = document.getElementById('quiz-title');
const counterElem = document.getElementById('card-counter');

// === HÀM TIỆN ÍCH (Mới thêm để tránh lỗi hiển thị) ===
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    // 1. Auth Guard
    const token = localStorage.getItem('quizAIToken');
    if (!token) { window.location.href = 'login.html'; return; }

    // 2. Lấy ID từ URL
    const params = new URLSearchParams(window.location.search);
    const quizId = params.get('quiz_id');
    if (!quizId) { alert("Không tìm thấy Quiz ID"); return; }

    // 3. Tải dữ liệu
    await loadQuizData(quizId);

    // 4. Sự kiện Lật thẻ
    flashcard.addEventListener('click', function() {
        flashcard.classList.toggle('flipped');
    });

    // 5. Sự kiện Điều hướng
    document.getElementById('next-card').addEventListener('click', (e) => {
        e.stopPropagation(); 
        nextCard();
    });
    document.getElementById('prev-card').addEventListener('click', (e) => {
        e.stopPropagation();
        prevCard();
    });
    
    // 6. Sự kiện Trộn thẻ
    document.getElementById('shuffle-card-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        shuffleArray(allQuestions);
        currentIndex = 0;
        renderCard();
        flashcard.classList.remove('flipped');
    });
});

async function loadQuizData(id) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/quiz/${id}`);
        if (!response.ok) throw new Error('Lỗi tải quiz');
        
        const data = await response.json();
        allQuestions = data.questions;
        quizTitleElem.innerText = "Học: " + data.title;

        if (allQuestions.length === 0) {
            frontContent.innerText = "Quiz này chưa có câu hỏi.";
            return;
        }

        renderCard();

    } catch (err) {
        console.error(err);
        frontContent.innerText = "Lỗi kết nối server.";
    }
}

// === ✅ CẬP NHẬT HÀM NÀY ĐỂ HIỂN THỊ 4 ĐÁP ÁN ===
function renderCard() {
    const q = allQuestions[currentIndex];
    
    // --- 1. MẶT TRƯỚC: CÂU HỎI + 4 LỰA CHỌN ---
    let frontHTML = `
        <div class="flashcard-question-text">${escapeHTML(q.question_text)}</div>
        
        <div class="flashcard-options">
            <div class="option-item"><strong>A.</strong> ${escapeHTML(q.choice_a)}</div>
            <div class="option-item"><strong>B.</strong> ${escapeHTML(q.choice_b)}</div>
            <div class="option-item"><strong>C.</strong> ${escapeHTML(q.choice_c)}</div>
            <div class="option-item"><strong>D.</strong> ${escapeHTML(q.choice_d)}</div>
        </div>
    `;
    frontContent.innerHTML = frontHTML;

    // --- 2. MẶT SAU: ĐÁP ÁN ĐÚNG + GIẢI THÍCH ---
    // Tìm nội dung text của đáp án đúng
    let correctAnswerText = "";
    if (q.correct_answer === 'A') correctAnswerText = q.choice_a;
    else if (q.correct_answer === 'B') correctAnswerText = q.choice_b;
    else if (q.correct_answer === 'C') correctAnswerText = q.choice_c;
    else if (q.correct_answer === 'D') correctAnswerText = q.choice_d;

    let backHTML = `
        <span class="correct-answer-highlight">${q.correct_answer}: ${escapeHTML(correctAnswerText)}</span>
    `;
    
    if (q.explanation && q.explanation !== "Không có giải thích") {
        backHTML += `<hr><p class="fs-6 mt-2 text-start">${escapeHTML(q.explanation)}</p>`;
    } else {
        backHTML += `<hr><p class="fs-6 mt-2 text-muted fst-italic">Chưa có giải thích chi tiết.</p>`;
    }

    backContent.innerHTML = backHTML;

    // Cập nhật bộ đếm
    counterElem.innerText = `${currentIndex + 1} / ${allQuestions.length}`;
}

function nextCard() {
    if (currentIndex < allQuestions.length - 1) {
        if (flashcard.classList.contains('flipped')) {
            flashcard.classList.remove('flipped');
            setTimeout(() => {
                currentIndex++;
                renderCard();
            }, 300);
        } else {
            currentIndex++;
            renderCard();
        }
    }
}

function prevCard() {
    if (currentIndex > 0) {
        if (flashcard.classList.contains('flipped')) {
            flashcard.classList.remove('flipped');
            setTimeout(() => {
                currentIndex--;
                renderCard();
            }, 300);
        } else {
            currentIndex--;
            renderCard();
        }
    }
}