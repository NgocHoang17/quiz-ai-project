// Biến toàn cục để lưu trữ dữ liệu quiz AI vừa tạo
let currentQuizData = null;

// === PHẦN KIỂM TRA XÁC THỰC (AUTH GUARD) ===

// Chạy ngay khi DOM tải xong
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');

    // 1. KIỂM TRA TOKEN
    if (!token) {
        // Nếu không có token, đẩy người dùng về trang đăng nhập
        window.location.href = 'login.html';
        return; // Dừng thực thi code nếu chưa đăng nhập
    } else {
        // Nếu có token, hiển thị thông tin chào mừng
        const welcomeMessage = document.getElementById('welcome-message');
        welcomeMessage.innerText = `Chào mừng, ${email}!`;
    }

    // 2. GẮN SỰ KIỆN ĐĂNG XUẤT
    const logoutButton = document.getElementById('logout-button');
    logoutButton.addEventListener('click', function() {
        // Xóa token khỏi bộ nhớ
        localStorage.removeItem('quizAIToken');
        localStorage.removeItem('quizAIUserEmail');
        
        // Đẩy người dùng về trang đăng nhập
        window.location.href = 'login.html';
    });
});


// === PHẦN XỬ LÝ TẠO QUIZ ===

// Lấy các phần tử HTML của quiz
const textInput = document.getElementById('text-input');
const generateButton = document.getElementById('generate-button');
const loadingMessage = document.getElementById('loading');
const quizResultDiv = document.getElementById('quiz-result');
const saveQuizButton = document.getElementById('save-quiz-button');
const saveQuizMessage = document.getElementById('save-quiz-message');

// Gắn sự kiện "click" cho nút Tạo Quiz
generateButton.addEventListener('click', function() {
    
    const text = textInput.value; 
    if (!text) {
        alert('Vui lòng nhập văn bản!');
        return;
    }

    // Đặt lại trạng thái
    loadingMessage.style.display = 'block';
    quizResultDiv.innerHTML = '<p class="text-muted">Đang tạo quiz...</p>';
    saveQuizButton.style.display = 'none'; // Ẩn nút lưu
    saveQuizMessage.innerText = '';
    currentQuizData = null; // Xóa quiz cũ

    fetch('http://127.0.0.1:8000/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
    })
    .then(response => response.json())
    .then(data => {
        loadingMessage.style.display = 'none'; 

        if (data.error) {
            quizResultDiv.innerHTML = `<p class="text-danger">Lỗi: ${data.error}</p>`;
        } else {
             if (typeof data.quiz_data === 'object' && data.quiz_data !== null) {
                // ✅ THÀNH CÔNG: Lưu quiz vào biến toàn cục
                currentQuizData = data.quiz_data;
                // Hiển thị quiz
                displayQuiz(currentQuizData);
                // Hiển thị nút "Lưu Quiz"
                saveQuizButton.style.display = 'block';
            } else {
                quizResultDiv.innerHTML = `<p class="text-danger">Lỗi: AI trả về định dạng không mong muốn.</p>`;
            }
        }
    })
    .catch(error => {
        loadingMessage.style.display = 'none'; 
        console.error('Lỗi nghiêm trọng:', error);
        quizResultDiv.innerHTML = '<p class="text-danger">Lỗi nghiêm trọng! Không thể kết nối đến server.</p>';
    });
});

// Hàm "vẽ" quiz ra HTML
function displayQuiz(quizArray) {
    quizResultDiv.innerHTML = '';
    quizArray.forEach((questionItem, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'quiz-question';
        const questionTitle = document.createElement('h4');
        questionTitle.innerText = `Câu ${index + 1}: ${questionItem.cau_hoi}`;
        questionDiv.appendChild(questionTitle);
        const choicesList = document.createElement('ul');
        for (const key in questionItem.lua_chon) {
            const choiceItem = document.createElement('li');
            choiceItem.innerText = `${key}: ${questionItem.lua_chon[key]}`;
            if (key === questionItem.dap_an) {
                choiceItem.className = 'correct-answer';
            }
            choicesList.appendChild(choiceItem);
        }
        questionDiv.appendChild(choicesList);
        quizResultDiv.appendChild(questionDiv);
    });
}


// === PHẦN MỚI: XỬ LÝ LƯU QUIZ (ĐÃ CẬP NHẬT XỬ LÝ LỖI 401) ===

saveQuizButton.addEventListener('click', async function() {
    if (!currentQuizData) {
        alert("Không có dữ liệu quiz để lưu!");
        return;
    }
    
    // 1. Lấy token
    const token = localStorage.getItem('quizAIToken');
    if (!token) {
        alert("Không tìm thấy token. Vui lòng đăng nhập lại.");
        window.location.href = 'login.html';
        return;
    }

    // 2. Hỏi người dùng tên của bộ quiz
    const quizTitle = prompt("Nhập tên cho bộ quiz này:", "Quiz mới");
    if (!quizTitle) { // Nếu người dùng nhấn "Cancel"
        return;
    }

    // 3. Chuẩn bị dữ liệu để gửi lên (theo schema QuizCreate)
    const dataToSave = {
        title: quizTitle,
        questions: currentQuizData.map(q => ({
            question_text: q.cau_hoi,
            choice_a: q.lua_chon.A,
            choice_b: q.lua_chon.B,
            choice_c: q.lua_chon.C,
            choice_d: q.lua_chon.D,
            correct_answer: q.dap_an
        }))
    };
    
    // 4. Gửi yêu cầu đến API /save-quiz
    saveQuizMessage.innerText = 'Đang lưu...';
    saveQuizMessage.className = 'text-primary';

    try {
        const response = await fetch('http://127.0.0.1:8000/save-quiz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Gửi token trong header Authorization
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dataToSave)
        });

        // === PHẦN CẬP NHẬT LỖI 401 ===
        if (response.ok) { // Nếu server trả về 2xx (thành công)
            const savedQuiz = await response.json();
            saveQuizMessage.innerText = `✅ Đã lưu thành công bộ quiz: "${savedQuiz.title}"`;
            saveQuizMessage.className = 'text-success';
            saveQuizButton.style.display = 'none';

        } else if (response.status === 401) {
            // LỖI 401 (Hết hạn token hoặc token không hợp lệ)
            saveQuizMessage.innerText = '❌ Lỗi: Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất và đăng nhập lại!';
            saveQuizMessage.className = 'text-danger';
            // Báo cho người dùng biết
            alert("Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.");
            // Xóa token hỏng
            localStorage.removeItem('quizAIToken');
            localStorage.removeItem('quizAIUserEmail');
            // Đẩy về trang login
            window.location.href = 'login.html';
            
        } else {
            // Lỗi khác (ví dụ 500, 400...)
            const errorData = await response.json();
            saveQuizMessage.innerText = `❌ Lỗi khi lưu: ${errorData.detail || 'Lỗi không xác định'}`;
            saveQuizMessage.className = 'text-danger';
        }
        // =============================

    } catch (err) {
        console.error("Lỗi khi lưu quiz:", err);
        saveQuizMessage.innerText = '❌ Lỗi kết nối. Không thể lưu quiz.';
        saveQuizMessage.className = 'text-danger';
    }
});