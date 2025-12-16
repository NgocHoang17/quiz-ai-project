let allQuestions = [];
let currentIndex = 0;
const flashcard = document.getElementById('flashcard');
const frontContent = document.getElementById('card-front-content');
const backContent = document.getElementById('card-back-content');
const quizTitleElem = document.getElementById('quiz-title');
const counterElem = document.getElementById('card-counter');

// === HÀM TIỆN ÍCH ===
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
    await loadQuizData(quizId, token); // ✅ Gửi token qua

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

async function loadQuizData(id, token) {
    try {
        // ✅ Sửa đường dẫn API thành /quizzes/ để khớp với Backend
        const response = await fetch(`http://127.0.0.1:8000/quizzes/${id}`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            // Lỗi 403, 404, 500
            throw new Error(`Lỗi tải quiz: ${response.status}`);
        }
        
        const data = await response.json();
        allQuestions = data.questions;
        quizTitleElem.innerText = "Học: " + data.title;

        if (allQuestions.length === 0) {
            frontContent.innerHTML = "<h4 class='text-muted'>Quiz này chưa có câu hỏi.</h4>";
            return;
        }

        renderCard();

    } catch (err) {
        console.error(err);
        frontContent.innerHTML = "<h4 class='text-danger'>Lỗi kết nối server hoặc quiz không tồn tại.</h4>";
    }
}

// === CẬP NHẬT HÀM RENDER NÀY ĐỂ HIỂN THỊ 4 ĐÁP ÁN + GIẢI THÍCH ===
function renderCard() {
    const q = allQuestions[currentIndex];
    
    // --- 1. MẶT TRƯỚC: CÂU HỎI + 4 LỰA CHỌN ---
    let frontHTML = `
        <div class="flashcard-question-text">${escapeHTML(q.question_text)}</div>
        
        <div class="flashcard-options mt-4 p-3 bg-light rounded">
            <div class="option-item mb-1"><strong>A.</strong> ${escapeHTML(q.choice_a)}</div>
            <div class="option-item mb-1"><strong>B.</strong> ${escapeHTML(q.choice_b)}</div>
            <div class="option-item mb-1"><strong>C.</strong> ${escapeHTML(q.choice_c)}</div>
            <div class="option-item"><strong>D.</strong> ${escapeHTML(q.choice_d)}</div>
        </div>
    `;
    frontContent.innerHTML = frontHTML;

    // --- 2. MẶT SAU: ĐÁP ÁN ĐÚNG + GIẢI THÍCH ---
    // Tìm nội dung text của đáp án đúng
    let correctAnswerText = "";
    const correctKey = q.correct_answer;
    const keyMap = { 'A': q.choice_a, 'B': q.choice_b, 'C': q.choice_c, 'D': q.choice_d };
    correctAnswerText = keyMap[correctKey] || "N/A";
    

    let backHTML = `
        <div class="bg-success text-white p-3 rounded mb-3">
            <h4 class="mb-0">ĐÁP ÁN: ${correctKey}</h4>
            <p class="mb-0 small fw-light">${escapeHTML(correctAnswerText)}</p>
        </div>
        <hr>
        <p class="fs-6 mt-3 text-start">
            <strong><i class="fa-solid fa-lightbulb me-2 text-warning"></i>Giải thích:</strong><br>
            ${escapeHTML(q.explanation || 'Chưa có giải thích chi tiết.')}
        </p>
        ${q.citation ? `<p class="small text-muted fst-italic mt-3"><i class="fa-solid fa-quote-left me-1"></i> Trích dẫn: ${escapeHTML(q.citation)}</p>` : ''}
    `;
    
    backContent.innerHTML = backHTML;

    // Cập nhật bộ đếm
    counterElem.innerText = `${currentIndex + 1} / ${allQuestions.length}`;
}

function nextCard() {
    if (currentIndex < allQuestions.length - 1) {
        // Luôn lật về mặt trước khi chuyển bài
        flashcard.classList.remove('flipped');
        setTimeout(() => {
            currentIndex++;
            renderCard();
        }, 300); // Đợi hiệu ứng lật xong (hoặc không cần timeout nếu bỏ hiệu ứng)
    }
}

function prevCard() {
    if (currentIndex > 0) {
        flashcard.classList.remove('flipped');
        setTimeout(() => {
            currentIndex--;
            renderCard();
        }, 300);
    }
}