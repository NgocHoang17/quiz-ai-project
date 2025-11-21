// Biến toàn cục để lưu trữ dữ liệu quiz AI vừa tạo
let currentQuizData = null;

// === PHẦN KIỂM TRA XÁC THỰC (AUTH GUARD) ===
document.addEventListener('DOMContentLoaded', function() {
    // ... (Toàn bộ code Auth Guard và Logout giữ nguyên) ...
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');

    if (!token) {
        window.location.href = 'login.html';
        return; 
    } else {
        const welcomeMessage = document.getElementById('welcome-message');
        welcomeMessage.innerText = `Chào mừng, ${email}!`;
    }

    const logoutButton = document.getElementById('logout-button');
    logoutButton.addEventListener('click', function() {
        localStorage.removeItem('quizAIToken');
        localStorage.removeItem('quizAIUserEmail');
        window.location.href = 'login.html';
    });
});

// === PHẦN XỬ LÝ TẠO QUIZ (ĐÃ CẬP NHẬT) ===

// Lấy các phần tử HTML
const generateButton = document.getElementById('generate-button');
const loadingMessage = document.getElementById('loading');
const quizResultDiv = document.getElementById('quiz-result');
const saveQuizButton = document.getElementById('save-quiz-button');
const saveQuizMessage = document.getElementById('save-quiz-message');

// Lấy các phần tử của Tab
const textInput = document.getElementById('text-input');
const fileInput = document.getElementById('file-input');
const textTabButton = document.getElementById('text-tab');
const fileTabButton = document.getElementById('file-tab');

// ✅✅✅ LẤY CÁC PHẦN TỬ TÙY CHỌN MỚI ✅✅✅
const quizCountInput = document.getElementById('quiz-count');
const quizTypeSelect = document.getElementById('quiz-type');

// Gắn sự kiện "click" cho nút Tạo Quiz
generateButton.addEventListener('click', function() {
    
    // 1. Lấy các tùy chọn mới
    const numQuestions = parseInt(quizCountInput.value);
    const quizType = quizTypeSelect.value;
    
    // 2. Kiểm tra tùy chọn
    if (isNaN(numQuestions) || numQuestions < 1 || numQuestions > 25) {
        alert("Vui lòng nhập số lượng câu hỏi hợp lệ (từ 1 đến 25).");
        return;
    }

    // 3. Kiểm tra xem tab nào đang active
    const isTextTabActive = textTabButton.classList.contains('active');
    
    // 4. Đặt lại trạng thái
    resetQuizState();

    if (isTextTabActive) {
        // --- Logic cho Tab "Dán văn bản" ---
        const text = textInput.value; 
        if (!text) {
            alert('Vui lòng nhập văn bản!');
            return;
        }
        // Gọi API /generate-quiz (đã thêm tùy chọn)
        fetchQuizFromText(text, numQuestions, quizType);
        
    } else {
        // --- Logic cho Tab "Tải file" ---
        const file = fileInput.files[0];
        if (!file) {
            alert('Vui lòng chọn một file!');
            return;
        }
        // Gọi API /upload-quiz-file (đã thêm tùy chọn)
        fetchQuizFromFile(file, numQuestions, quizType);
    }
});

// Hàm reset trạng thái (giữ nguyên)
function resetQuizState() {
    loadingMessage.style.display = 'block';
    quizResultDiv.innerHTML = '<p class="text-muted">Đang tạo quiz...</p>';
    saveQuizButton.style.display = 'none'; 
    saveQuizMessage.innerText = '';
    currentQuizData = null; 
}

// === CẬP NHẬT CÁC HÀM FETCH ===

// Hàm gọi API /generate-quiz (cho text)
function fetchQuizFromText(text, numQuestions, quizType) {
    fetch('http://127.0.0.1:8000/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ✅ Gửi thêm tùy chọn trong body
        body: JSON.stringify({ 
            text: text, 
            num_questions: numQuestions, 
            quiz_type: quizType 
        })
    })
    .then(response => response.json())
    .then(handleApiResponse) // Dùng hàm xử lý chung
    .catch(handleApiError);
}

// Hàm gọi API /upload-quiz-file (cho file)
function fetchQuizFromFile(file, numQuestions, quizType) {
    const formData = new FormData();
    formData.append('file', file);
    // ✅ Gửi thêm tùy chọn dưới dạng Form Data
    formData.append('num_questions', numQuestions);
    formData.append('quiz_type', quizType);
    
    fetch('http://127.0.0.1:8000/upload-quiz-file', {
        method: 'POST',
        body: formData 
    })
    .then(response => response.json())
    .then(handleApiResponse) // Dùng hàm xử lý chung
    .catch(handleApiError);
}

// --- Các hàm xử lý kết quả (Dùng chung) (Giữ nguyên) ---
function handleApiResponse(data) {
    loadingMessage.style.display = 'none'; 
    if (data.error) {
        quizResultDiv.innerHTML = `<p class="text-danger">Lỗi: ${data.error}</p>`;
    } else {
         if (typeof data.quiz_data === 'object' && data.quiz_data !== null) {
            currentQuizData = data.quiz_data;
            displayQuiz(currentQuizData);
            saveQuizButton.style.display = 'block';
        } else {
            quizResultDiv.innerHTML = `<p class="text-danger">Lỗi: AI trả về định dạng không mong muốn.</p>`;
        }
    }
}
function handleApiError(error) {
    loadingMessage.style.display = 'none'; 
    console.error('Lỗi nghiêm trọng:', error);
    quizResultDiv.innerHTML = '<p class="text-danger">Lỗi nghiêm trọng! Không thể kết nối đến server.</p>';
}

// Hàm "vẽ" quiz ra HTML (Giữ nguyên)
function displayQuiz(quizArray) {
    // ... (Code giữ nguyên) ...
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

// === PHẦN XỬ LÝ LƯU QUIZ (Giữ nguyên) ===
saveQuizButton.addEventListener('click', async function() {
    // ... (Toàn bộ code Lưu Quiz giữ nguyên) ...
    if (!currentQuizData) {
        alert("Không có dữ liệu quiz để lưu!");
        return;
    }
    const token = localStorage.getItem('quizAIToken');
    if (!token) {
        alert("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        window.location.href = 'login.html';
        return;
    }
    const quizTitle = prompt("Nhập tên cho bộ quiz này:", "Quiz mới");
    if (!quizTitle) { 
        return;
    }
    const dataToSave = {
        title: quizTitle,
        questions: currentQuizData.map(q => ({
            question_text: q.cau_hoi,
            choice_a: q.lua_chon.A,
            choice_b: q.lua_chon.B,
            choice_c: q.lua_chon.C,
            choice_d: q.lua_chon.D,
            correct_answer: q.dap_an,
            explanation: q.giai_thich || "Không có giải thích",
            citation: q.trich_dan || "Không có trích dẫn"
        }))
    };
    saveQuizMessage.innerText = 'Đang lưu...';
    saveQuizMessage.className = 'text-primary';
    try {
        const response = await fetch('http://127.0.0.1:8000/save-quiz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dataToSave)
        });
        if (response.ok) { 
            const savedQuiz = await response.json();
            saveQuizMessage.innerText = `✅ Đã lưu thành công bộ quiz: "${savedQuiz.title}"`;
            saveQuizMessage.className = 'text-success';
            saveQuizButton.style.display = 'none';
        } else if (response.status === 401) {
            saveQuizMessage.innerText = '❌ Lỗi: Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất và đăng nhập lại!';
            saveQuizMessage.className = 'text-danger';
            alert("Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại.");
            localStorage.removeItem('quizAIToken');
            localStorage.removeItem('quizAIUserEmail');
            window.location.href = 'login.html';
        } else {
            const errorData = await response.json();
            saveQuizMessage.innerText = `❌ Lỗi khi lưu: ${errorData.detail || 'Lỗi không xác định'}`;
            saveQuizMessage.className = 'text-danger';
        }
    } catch (err) {
        console.error("Lỗi khi lưu quiz:", err);
        saveQuizMessage.innerText = '❌ Lỗi kết nối. Không thể lưu quiz.';
        saveQuizMessage.className = 'text-danger';
    }
});