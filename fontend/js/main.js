// === PHẦN KIỂM TRA XÁC THỰC (AUTH GUARD) ===

// Chạy ngay khi DOM tải xong
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');

    // 1. KIỂM TRA TOKEN
    if (!token) {
        // Nếu không có token, đẩy người dùng về trang đăng nhập
        window.location.href = 'login.html';
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


// === PHẦN XỬ LÝ TẠO QUIZ (Giữ nguyên) ===

const textInput = document.getElementById('text-input');
const generateButton = document.getElementById('generate-button');
const loadingMessage = document.getElementById('loading');
const quizResultDiv = document.getElementById('quiz-result');

generateButton.addEventListener('click', function() {
    
    const text = textInput.value; 
    if (!text) {
        alert('Vui lòng nhập văn bản!');
        return;
    }

    loadingMessage.style.display = 'block';
    quizResultDiv.innerHTML = ''; 

    fetch('http://127.0.0.1:8000/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
    })
    .then(response => response.json())
    .then(data => {
        loadingMessage.style.display = 'none'; 

        if (data.error) {
            quizResultDiv.innerHTML = `<p style="color: red;">Lỗi: ${data.error}</p>`;
        } else {
             if (typeof data.quiz_data === 'object' && data.quiz_data !== null) {
                displayQuiz(data.quiz_data);
            } else {
                quizResultDiv.innerHTML = `<p style="color: red;">Lỗi: AI trả về định dạng không mong muốn.</p>`;
            }
        }
    })
    .catch(error => {
        loadingMessage.style.display = 'none'; 
        console.error('Lỗi nghiêm trọng:', error);
        quizResultDiv.innerHTML = '<p style="color: red;">Lỗi nghiêm trọng! Không thể kết nối đến server.</p>';
    });
});

// Hàm "vẽ" quiz ra HTML (Giữ nguyên)
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