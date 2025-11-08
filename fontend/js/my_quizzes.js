// Biến toàn cục để lưu danh sách quiz, giúp modal truy cập dễ dàng
let userQuizzes = [];
// Biến toàn cục để giữ đối tượng Modal của Bootstrap
let viewModal = null;

// === PHẦN KIỂM TRA XÁC THỰC (AUTH GUARD) ===
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');

    if (!token) {
        window.location.href = 'login.html';
        return; 
    }
    
    // Khởi tạo đối tượng Modal của Bootstrap
    viewModal = new bootstrap.Modal(document.getElementById('viewQuizModal'));
    
    const welcomeMessage = document.getElementById('welcome-message');
    welcomeMessage.innerText = `Chào mừng, ${email}!`;

    const logoutButton = document.getElementById('logout-button');
    logoutButton.addEventListener('click', function() {
        localStorage.removeItem('quizAIToken');
        localStorage.removeItem('quizAIUserEmail');
        window.location.href = 'login.html';
    });
    
    // Tải danh sách quiz
    fetchUserQuizzes(token);
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
            quizListContainer.innerHTML = ''; // Xóa trắng container
            
            // Lưu vào biến toàn cục
            userQuizzes = quizzes; 
            
            if (userQuizzes.length === 0) {
                quizListContainer.innerHTML = '<p class="text-muted">Bạn chưa lưu bộ quiz nào.</p>';
                return;
            }
            
            // "Vẽ" từng quiz ra, truyền vào "index" của mảng
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

// === HÀM "VẼ" MỘT QUIZ ITEM (Đã cập nhật) ===
function createQuizElement(quiz, index) {
    const quizItem = document.createElement('div');
    // Thêm ID cho thẻ div để dễ dàng xóa/cập nhật tên
    quizItem.id = `quiz-item-${quiz.id}`; 
    quizItem.className = 'list-group-item list-group-item-action flex-column align-items-start';

    const timeAgo = formatTimeAgo(quiz.created_at);

    // Cập nhật các nút bấm để gọi hàm JS với "index"
    quizItem.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <h5 class="mb-1 quiz-title">${escapeHTML(quiz.title)}</h5>
            <small class="text-muted">${timeAgo}</small>
        </div>
        <p class="mb-1">Bao gồm ${quiz.questions.length} câu hỏi.</p>
        
        <button class="btn btn-primary btn-sm mt-2" onclick="viewQuiz(${index})">Xem</button>
        <button class="btn btn-warning btn-sm mt-2" onclick="editQuizTitle(${index})">Sửa tên</button>
        <button class="btn btn-outline-danger btn-sm mt-2" onclick="deleteQuiz(${index})">Xóa</button>
    `;
    return quizItem;
}

// === CÁC HÀM TƯƠNG TÁC MỚI ===

// 1. HÀM XEM QUIZ (MỞ MODAL)
function viewQuiz(index) {
    const quiz = userQuizzes[index];
    const modalTitle = document.getElementById('viewQuizModalLabel');
    const modalBody = document.getElementById('viewQuizModalBody');

    // Cập nhật tên của modal
    modalTitle.innerText = `Nội dung: ${escapeHTML(quiz.title)}`;
    
    // "Vẽ" các câu hỏi vào thân modal
    modalBody.innerHTML = ''; // Xóa nội dung cũ
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
    
    // Dùng API của Bootstrap để mở modal
    viewModal.show();
}

// 2. HÀM SỬA TÊN QUIZ
async function editQuizTitle(index) {
    const quiz = userQuizzes[index];
    const token = localStorage.getItem('quizAIToken');

    // 1. Hỏi tên mới
    const newTitle = prompt("Nhập tên mới cho bộ quiz:", quiz.title);
    
    if (!newTitle || newTitle === quiz.title) {
        return; // Hủy nếu không nhập gì hoặc tên không đổi
    }
    
    // 2. Gọi API để cập nhật
    try {
        const response = await fetch(`http://127.0.0.1:8000/quizzes/${quiz.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: newTitle }) // Gửi tên mới
        });

        if (response.ok) {
            const updatedQuiz = await response.json();
            // Cập nhật lại dữ liệu trong mảng toàn cục
            userQuizzes[index] = updatedQuiz;
            // Cập nhật tên trên giao diện (DOM)
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
    
    // 1. Xác nhận
    if (!confirm(`Bạn có chắc chắn muốn xóa bộ quiz "${escapeHTML(quiz.title)}"? Hành động này không thể hoàn tác.`)) {
        return; // Hủy nếu người dùng không đồng ý
    }

    // 2. Gọi API để xóa
    try {
        const response = await fetch(`http://127.0.0.1:8000/quizzes/${quiz.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            // Xóa khỏi mảng toàn cục
            userQuizzes.splice(index, 1);
            // Xóa khỏi giao diện (DOM)
            document.getElementById(`quiz-item-${quiz.id}`).remove();
            alert("Đã xóa quiz thành công!");
            
            // Kiểm tra xem còn quiz nào không
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

// === CÁC HÀM TIỆN ÍCH (HELPER FUNCTIONS) ===
// (Giữ nguyên 2 hàm: escapeHTML và formatTimeAgo)
function escapeHTML(str) {
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