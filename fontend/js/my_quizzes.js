// Biến toàn cục
let userQuizzes = [];
let viewModal = null;
let startQuizModal = null; // Biến mới cho Modal Tùy chọn
let quizIdToStart = null; // Biến mới để lưu quizId

// === PHẦN KIỂM TRA XÁC THỰC (AUTH GUARD) ===
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');

    if (!token) {
        window.location.href = 'login.html';
        return; 
    }
    
    // Khởi tạo cả 2 Modal
    viewModal = new bootstrap.Modal(document.getElementById('viewQuizModal'));
    startQuizModal = new bootstrap.Modal(document.getElementById('startQuizOptionsModal')); // Khởi tạo Modal mới
    
    const welcomeMessage = document.getElementById('welcome-message');
    welcomeMessage.innerText = `Chào mừng, ${email}!`;

    const logoutButton = document.getElementById('logout-button');
    logoutButton.addEventListener('click', function() {
        localStorage.removeItem('quizAIToken');
        localStorage.removeItem('quizAIUserEmail');
        window.location.href = 'login.html';
    });
    
    fetchUserQuizzes(token);

    // Lập trình cho nút "Bắt đầu" TRONG MODAL
    document.getElementById('start-quiz-button').addEventListener('click', function() {
        // 1. Lấy các tùy chọn
        const shuffleQuestions = document.getElementById('modal-shuffle-questions').checked;
        const shuffleChoices = document.getElementById('modal-shuffle-choices').checked;

        // 2. Lấy quizId đã lưu
        if (quizIdToStart === null) return;

        // 3. Tạo URL mới với các tùy chọn
        const url = `do_quiz.html?quiz_id=${quizIdToStart}&shuffle_q=${shuffleQuestions}&shuffle_c=${shuffleChoices}`;
        
        // 4. Chuyển trang
        window.location.href = url;
    });
});

// === HÀM TẢI VÀ HIỂN THỊ QUIZ ===
async function fetchUserQuizzes(token) {
    const loadingP = document.getElementById('loading-quizzes');
    const quizListContainer = document.getElementById('quiz-list-container');
    
    try {
        const response = await fetch('http://127.0.0.1:8000/my-quizzes', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const quizzes = await response.json();
            loadingP.style.display = 'none';
            quizListContainer.innerHTML = ''; 
            
            userQuizzes = quizzes; 
            
            if (userQuizzes.length === 0) {
                quizListContainer.innerHTML = '<p class="text-muted">Bạn chưa lưu bộ quiz nào.</p>';
                return;
            }
            
            userQuizzes.forEach((quiz, index) => {
                const quizItem = createQuizElement(quiz, index);
                quizListContainer.appendChild(quizItem);
            });

        } else if (response.status === 401) {
            alert("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
            localStorage.removeItem('quizAIToken');
            localStorage.removeItem('quizAIUserEmail');
            window.location.href = 'login.html';
        } else {
            loadingP.innerText = 'Lỗi khi tải danh sách quiz.';
            loadingP.className = 'text-danger';
        }
        
    } catch (err) {
        console.error("Lỗi fetchUserQuizzes:", err);
        loadingP.innerText = 'Lỗi kết nối. Không thể tải quiz.';
        loadingP.className = 'text-danger';
    }
}

// === HÀM "VẼ" MỘT QUIZ ITEM ===
function createQuizElement(quiz, index) {
    const quizItem = document.createElement('div');
    quizItem.id = `quiz-item-${quiz.id}`; 
    quizItem.className = 'list-group-item list-group-item-action flex-column align-items-start';

    const timeAgo = formatTimeAgo(quiz.created_at);

    quizItem.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <h5 class="mb-1 quiz-title">${escapeHTML(quiz.title)}</h5>
            <small class="text-muted">${timeAgo}</small>
        </div>
        <p class="mb-1">Bao gồm ${quiz.questions.length} câu hỏi.</p>
        
        <button class="btn btn-primary btn-sm mt-2" onclick="startQuiz(${quiz.id})">Làm bài</button>
        <button class="btn btn-success btn-sm mt-2" onclick="shareQuiz(${quiz.id})">Chia sẻ</button>
        <button class="btn btn-info btn-sm mt-2" onclick="viewQuiz(${index})">Xem</button>
        <button class="btn btn-warning btn-sm mt-2" onclick="editQuizTitle(${index})">Sửa tên</button>
        <button class="btn btn-outline-danger btn-sm mt-2" onclick="deleteQuiz(${index})">Xóa</button>
    `;
    return quizItem;
}

// === CÁC HÀM TƯƠNG TÁC ===

// 1. HÀM XEM QUIZ (MỞ MODAL)
function viewQuiz(index) {
    const quiz = userQuizzes[index];
    const modalTitle = document.getElementById('viewQuizModalLabel');
    const modalBody = document.getElementById('viewQuizModalBody');

    modalTitle.innerText = `Nội dung: ${escapeHTML(quiz.title)}`;
    
    modalBody.innerHTML = ''; 
    quiz.questions.forEach((q, i) => {
        modalBody.innerHTML += `
            <div class="quiz-question">
                <h4>Câu ${i + 1}: ${escapeHTML(q.question_text)}</h4>
                <ul>
                    <li class="${q.correct_answer === 'A' ? 'correct-answer' : ''}">A: ${escapeHTML(q.choice_a)}</li>
                    <li class="${q.correct_answer === 'B' ? 'correct-answer' : ''}">B: ${escapeHTML(q.choice_b)}</li>
                    <li class="${q.correct_answer === 'C' ? 'correct-answer' : ''}">C: ${escapeHTML(q.choice_c)}</li>
                    <li class="${q.correct_answer === 'D' ? 'correct-answer' : ''}">D: ${escapeHTML(q.choice_d)}</li>
                </ul>
            </div>
        `;
    });
    
    viewModal.show();
}

// 2. HÀM SỬA TÊN QUIZ
async function editQuizTitle(index) {
    const quiz = userQuizzes[index];
    const token = localStorage.getItem('quizAIToken');

    const newTitle = prompt("Nhập tên mới cho bộ quiz:", quiz.title);
    
    if (!newTitle || newTitle === quiz.title) {
        return; 
    }
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/quizzes/${quiz.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: newTitle }) 
        });

        if (response.ok) {
            const updatedQuiz = await response.json();
            userQuizzes[index] = updatedQuiz;
            document.querySelector(`#quiz-item-${quiz.id} .quiz-title`).innerText = escapeHTML(updatedQuiz.title);
            alert("Đổi tên thành công!");
        } else {
            alert("Đã xảy ra lỗi khi đổi tên.");
        }
    } catch (err) {
        alert("Lỗi kết nối khi đổi tên.");
    }
}

// 3. HÀM XÓA QUIZ
async function deleteQuiz(index) {
    const quiz = userQuizzes[index];
    const token = localStorage.getItem('quizAIToken');
    
    if (!confirm(`Bạn có chắc chắn muốn xóa bộ quiz "${escapeHTML(quiz.title)}"? Hành động này không thể hoàn tác.`)) {
        return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:8000/quizzes/${quiz.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            userQuizzes.splice(index, 1);
            document.getElementById(`quiz-item-${quiz.id}`).remove();
            alert("Đã xóa quiz thành công!");
            
            if (userQuizzes.length === 0) {
                 document.getElementById('quiz-list-container').innerHTML = '<p class="text-muted">Bạn chưa lưu bộ quiz nào.</p>';
            }
        } else {
            alert("Đã xảy ra lỗi khi xóa quiz.");
        }
    } catch (err) {
        alert("Lỗi kết nối khi xóa quiz.");
    }
}

// === 4. HÀM LÀM BÀI (ĐÃ CẬP NHẬT) ===
function startQuiz(quizId) {
    // 1. Lưu ID quiz vào biến toàn cục
    quizIdToStart = quizId;
    
    // 2. Mở Modal tùy chọn
    startQuizModal.show();
}

// 5. HÀM CHIA SẺ QUIZ
function shareQuiz(quizId) {
    const shareUrl = `do_quiz.html?quiz_id=${quizId}`;
    const fullShareUrl = new URL(shareUrl, window.location.href).href;
    try {
        navigator.clipboard.writeText(fullShareUrl);
        alert(`Đã sao chép link chia sẻ vào clipboard:\n\n${fullShareUrl}`);
    } catch (err) {
        console.error('Không thể sao chép: ', err);
        prompt("Không thể tự động sao chép. Vui lòng sao chép link này:", fullShareUrl);
    }
}

// === CÁC HÀM TIỆN ÍCH (HELPER FUNCTIONS) ===
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " năm trước";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " tháng trước";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " ngày trước";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " giờ trước";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " phút trước";
    return Math.floor(seconds) + " giây trước";
}