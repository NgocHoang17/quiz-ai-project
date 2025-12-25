// Biến toàn cục
let currentQuizData = null;
let saveQuizModal = null;

// === AUTH GUARD ===
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');

    if (!token) {
        window.location.href = 'login.html';
        return; 
    } else {
        document.getElementById('welcome-message').innerText = `Chào mừng, ${email}!`;
    }

    const modalEl = document.getElementById('saveQuizModal');
    if (modalEl) {
        saveQuizModal = new bootstrap.Modal(modalEl);
    }

    document.getElementById('logout-button').addEventListener('click', function() {
        localStorage.removeItem('quizAIToken');
        localStorage.removeItem('quizAIUserEmail');
        window.location.href = 'login.html';
    });

    //  KÍCH HOẠT TÍNH NĂNG KÉO THẢ
    setupDragAndDrop();
});

// === LOGIC TẠO QUIZ ===
const generateButton = document.getElementById('generate-button');
const loadingMessage = document.getElementById('loading');
const quizResultDiv = document.getElementById('quiz-result');
const saveQuizButton = document.getElementById('save-quiz-button');
const saveQuizMessage = document.getElementById('save-quiz-message');

const textInput = document.getElementById('text-input');
const fileInput = document.getElementById('file-input');
const textTabButton = document.getElementById('text-tab');

const quizCountInput = document.getElementById('quiz-count');
const quizTypeSelect = document.getElementById('quiz-type');

// ===  HÀM XỬ LÝ KÉO THẢ (DRAG & DROP) ===
function setupDragAndDrop() {
    const uploadArea = document.querySelector('.upload-area');
    const fileInput = document.getElementById('file-input');

    if (!uploadArea) return;

    // 1. Ngăn chặn hành vi mặc định (mở file) của trình duyệt
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 2. Hiệu ứng khi kéo file vào (Highlight)
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.add('active'), false);
    });

    // 3. Bỏ hiệu ứng khi kéo ra hoặc thả
    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('active'), false);
    });

    // 4. Xử lý khi thả file (Drop)
    uploadArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            // Gán file vừa thả vào ô input
            fileInput.files = files;
            console.log("Đã nhận file:", files[0].name);
        }
    }
}
// ==========================================


// === NÚT TẠO QUIZ ===
generateButton.addEventListener('click', function() {
    const numQuestions = parseInt(quizCountInput.value);
    const quizType = quizTypeSelect.value;
    
    if (isNaN(numQuestions) || numQuestions < 1 || numQuestions > 25) {
        alert("Vui lòng nhập số lượng câu hỏi hợp lệ (1-20).");
        return;
    }

    const isTextTabActive = textTabButton.classList.contains('active');
    resetQuizState();

    if (isTextTabActive) {
        const text = textInput.value; 
        if (!text) { alert('Vui lòng nhập văn bản!'); return; }
        fetchQuizFromText(text, numQuestions, quizType);
    } else {
        const file = fileInput.files[0];
        if (!file) { alert('Vui lòng chọn (hoặc kéo thả) một file!'); return; }
        fetchQuizFromFile(file, numQuestions, quizType);
    }
});

function resetQuizState() {
    loadingMessage.style.display = 'block';
    quizResultDiv.innerHTML = '<p class="text-muted">Đang tạo quiz...</p>';
    saveQuizButton.style.display = 'none'; 
    saveQuizMessage.innerText = '';
    currentQuizData = null; 
}

// === API CALLS ===
function fetchQuizFromText(text, numQuestions, quizType) {
    fetch('http://127.0.0.1:8000/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, num_questions: numQuestions, quiz_type: quizType })
    })
    .then(response => response.json())
    .then(handleApiResponse)
    .catch(handleApiError);
}

function fetchQuizFromFile(file, numQuestions, quizType) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('num_questions', numQuestions);
    formData.append('quiz_type', quizType);
    
    fetch('http://127.0.0.1:8000/upload-quiz-file', {
        method: 'POST',
        body: formData 
    })
    .then(response => response.json())
    .then(handleApiResponse)
    .catch(handleApiError);
}

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

// === LOGIC LƯU QUIZ ===
saveQuizButton.addEventListener('click', async function() {
    if (!currentQuizData) { alert("Không có dữ liệu quiz!"); return; }
    
    const token = localStorage.getItem('quizAIToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Tải danh sách folder
    const folderSelect = document.getElementById('save-quiz-folder-select');
    folderSelect.innerHTML = '<option value="">Đang tải...</option>';
    
    try {
        const res = await fetch('http://127.0.0.1:8000/folders', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const folders = await res.json();
            folderSelect.innerHTML = '<option value="">(Thư mục gốc)</option>';
            folders.forEach(f => {
                folderSelect.innerHTML += `<option value="${f.id}">${f.name}</option>`;
            });
            saveQuizModal.show();
        } else {
            alert("Lỗi tải danh sách thư mục.");
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi kết nối.");
    }
});

// XỬ LÝ LƯU QUIZ 
document.getElementById('confirm-save-quiz-btn').addEventListener('click', async function() {
    const token = localStorage.getItem('quizAIToken');
    
    const titleInput = document.getElementById('save-quiz-title-input');
    const folderSelect = document.getElementById('save-quiz-folder-select');
    
    const quizTypeSelect = document.getElementById('quiz-type');
    const currentQuizType = quizTypeSelect ? quizTypeSelect.value : 'mcq';

    const quizTitle = titleInput.value.trim() || "Quiz mới";
    const folderIdVal = folderSelect.value;
    const folderId = folderIdVal === "" ? null : parseInt(folderIdVal);

    const dataToSave = {
        title: quizTitle,
        folder_id: folderId, 
        quiz_type: currentQuizType, 
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
    
    saveQuizModal.hide();
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
            
            // Format tên loại quiz cho đẹp khi thông báo
            let typeLabel = "Trắc nghiệm";
            if (currentQuizType === 'fill_in_blank') typeLabel = "Điền khuyết";
            else if (currentQuizType === 'exercise') typeLabel = "Bài tập";
            else if (currentQuizType === 'mixed') typeLabel = "Hỗn hợp";

            saveQuizMessage.innerText = `✅ Đã lưu thành công: "${savedQuiz.title}" (${typeLabel})`;
            saveQuizMessage.className = 'text-success';
            saveQuizButton.style.display = 'none'; 
        } else if (response.status === 401) {
            saveQuizMessage.innerText = '❌ Lỗi: Hết phiên đăng nhập.';
            localStorage.removeItem('quizAIToken');
            window.location.href = 'login.html';
        } else {
            const errorData = await response.json();
            saveQuizMessage.innerText = `❌ Lỗi khi lưu: ${errorData.detail || 'Lỗi không xác định'}`;
            saveQuizMessage.className = 'text-danger';
        }
    } catch (err) {
        console.error("Lỗi lưu:", err);
        saveQuizMessage.innerText = '❌ Lỗi kết nối.';
        saveQuizMessage.className = 'text-danger';
    }
});