// === BIẾN TOÀN CỤC ===
let allQuizzes = [];
let allFolders = [];
let currentViewFolderId = null; // null = Thư mục gốc
let quizIdToMove = null;
let quizIdToStart = null;

// Modal instances
let viewModal, startQuizModal, createFolderModal, moveQuizModal;

document.addEventListener('DOMContentLoaded', function () {
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');

    if (!token) { window.location.href = 'login.html'; return; }

    // Init Modals
    viewModal = new bootstrap.Modal(document.getElementById('viewQuizModal'));
    startQuizModal = new bootstrap.Modal(document.getElementById('startQuizModal'));
    createFolderModal = new bootstrap.Modal(document.getElementById('createFolderModal'));
    moveQuizModal = new bootstrap.Modal(document.getElementById('moveQuizModal'));

    document.getElementById('welcome-message').innerText = `Chào, ${email}`;
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.clear(); window.location.href = 'login.html';
    });

    // Load Data
    refreshData(token);

    // --- EVENT LISTENERS CHO MODAL ---
    
    // 1. Ẩn/Hiện ô nhập phút khi chọn chế độ
    document.querySelectorAll('input[name="quizMode"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const timerSection = document.getElementById('timer-input-section');
            if (timerSection) {
                if (this.value === 'timer') timerSection.classList.remove('d-none');
                else timerSection.classList.add('d-none');
            }
        });
    });

    // 2. Xử lý nút BẮT ĐẦU (Kèm logic Trộn)
    const btnConfirmStart = document.getElementById('btn-confirm-start');
    if (btnConfirmStart) {
        btnConfirmStart.addEventListener('click', function() {
            // Lấy chế độ
            const modeRadio = document.querySelector('input[name="quizMode"]:checked');
            const mode = modeRadio ? modeRadio.value : 'practice';
            
            // Lấy thời gian
            let time = 0;
            if (mode === 'timer') {
                const durationInput = document.getElementById('quiz-duration');
                time = durationInput ? durationInput.value : 15;
            }
            
            // Lấy tùy chọn trộn
            const shuffleQ = document.getElementById('shuffleQuestions').checked ? 1 : 0;
            const shuffleA = document.getElementById('shuffleAnswers').checked ? 1 : 0;
            
            // Chuyển hướng
            if (quizIdToStart) {
                window.location.href = `do_quiz.html?quiz_id=${quizIdToStart}&time=${time}&shuffle_q=${shuffleQ}&shuffle_a=${shuffleA}`;
            }
        });
    }

    // --- CÁC EVENT KHÁC ---
    document.getElementById('confirm-create-folder').addEventListener('click', () => createFolder(token));
    document.getElementById('confirm-move-quiz').addEventListener('click', () => confirmMoveQuiz(token));
});

// === QUẢN LÝ DỮ LIỆU ===
async function refreshData(token) {
    document.getElementById('loading-indicator').style.display = 'block';
    try {
        const [foldersRes, quizzesRes] = await Promise.all([
            fetch('http://127.0.0.1:8000/folders', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://127.0.0.1:8000/my-quizzes', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (foldersRes.ok && quizzesRes.ok) {
            allFolders = await foldersRes.json();
            allQuizzes = await quizzesRes.json();
            renderCurrentView();
        } else if (foldersRes.status === 401 || quizzesRes.status === 401) {
            localStorage.clear(); window.location.href = 'login.html';
        }
    } catch (err) { console.error("Lỗi tải dữ liệu:", err); } 
    finally { document.getElementById('loading-indicator').style.display = 'none'; }
}

// === HIỂN THỊ GIAO DIỆN ===
function renderCurrentView() {
    const folderContainer = document.getElementById('folders-container');
    const quizContainer = document.getElementById('quiz-list-container');
    const breadcrumb = document.getElementById('folder-breadcrumb');
    const emptyMsg = document.getElementById('empty-msg');
    const divider = document.getElementById('folder-divider');

    folderContainer.innerHTML = '';
    quizContainer.innerHTML = '';

    // Breadcrumb
    if (currentViewFolderId === null) {
        breadcrumb.innerHTML = `<li class="breadcrumb-item active">Thư mục gốc</li>`;
    } else {
        const currentFolder = allFolders.find(f => f.id === currentViewFolderId);
        const folderName = currentFolder ? currentFolder.name : "Thư mục";
        breadcrumb.innerHTML = `<li class="breadcrumb-item"><a href="#" onclick="switchFolder(null)">Thư mục gốc</a></li><li class="breadcrumb-item active">${escapeHTML(folderName)}</li>`;
    }

    // Folders
    let hasFolders = false;
    if (currentViewFolderId === null) {
        allFolders.forEach(folder => {
            hasFolders = true;
            folderContainer.innerHTML += `
                <div class="col-6 col-md-4 col-lg-3">
                    <div class="card folder-card h-100 p-3 text-center" onclick="switchFolder(${folder.id})">
                        <i class="fa-solid fa-folder folder-icon mb-2"></i>
                        <h6 class="text-truncate" title="${escapeHTML(folder.name)}">${escapeHTML(folder.name)}</h6>
                        <button class="btn btn-outline-danger btn-sm mt-2 py-0 px-2" onclick="event.stopPropagation(); deleteFolder(${folder.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
        });
    }

    // Quizzes
    const quizzesInView = allQuizzes.filter(q => q.folder_id === currentViewFolderId);
    quizzesInView.forEach(quiz => {
        quizContainer.appendChild(createQuizElement(quiz));
    });

    divider.style.display = (hasFolders && quizzesInView.length > 0) ? 'block' : 'none';
    emptyMsg.style.display = (!hasFolders && quizzesInView.length === 0) ? 'block' : 'none';
}

// ✅ CẬP NHẬT: HÀM TẠO HTML QUIZ (CÓ NÚT TRÁI TIM)
function createQuizElement(quiz) {
    const quizItem = document.createElement('div');
    quizItem.id = `quiz-item-${quiz.id}`;
    quizItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
    const timeAgo = formatTimeAgo(quiz.created_at);

    // Xác định icon trái tim (Đỏ nếu true, Xám viền nếu false)
    const heartIcon = quiz.is_favorite ? 'fa-solid fa-heart text-danger' : 'fa-regular fa-heart text-muted';

    quizItem.innerHTML = `
        <div class="flex-grow-1 d-flex align-items-center gap-3">
            <button class="btn btn-link p-0 text-decoration-none" onclick="toggleFavorite(event, ${quiz.id})" title="Yêu thích">
                <i class="${heartIcon} fs-4" id="fav-icon-${quiz.id}"></i>
            </button>

            <div onclick="viewQuiz(${quiz.id})" style="cursor: pointer;" class="flex-grow-1">
                <h5 class="mb-1 text-primary fw-bold text-decoration-none">
                    <i class="fa-regular fa-file-lines me-2"></i>${escapeHTML(quiz.title)}
                </h5>
                <small class="text-muted">
                    <i class="fa-solid fa-layer-group me-1"></i> ${quiz.questions.length} câu &bull; 
                    <i class="fa-regular fa-clock me-1"></i> ${timeAgo}
                </small>
            </div>
        </div>
        
        <div class="d-flex align-items-center gap-2">
            <button onclick="openStartModal(${quiz.id}, '${escapeHTML(quiz.title)}')" class="btn btn-primary btn-sm"><i class="fa-solid fa-play me-1"></i> Làm bài</button>
            <div class="dropdown">
                <button class="btn btn-light btn-sm border" type="button" data-bs-toggle="dropdown"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                <ul class="dropdown-menu dropdown-menu-end shadow">
                    <li><a class="dropdown-item" href="flashcard.html?quiz_id=${quiz.id}"><i class="fa-solid fa-layer-group me-2 text-warning"></i> Học Flashcard</a></li>
                    <li><button class="dropdown-item" onclick="viewQuiz(${quiz.id})"><i class="fa-solid fa-eye me-2 text-info"></i> Xem chi tiết</button></li>
                    <li><button class="dropdown-item" onclick="downloadDocx(${quiz.id})"><i class="fa-solid fa-file-word me-2 text-primary"></i> Tải xuống</button></li>
                    <li><button class="dropdown-item" onclick="shareQuiz(${quiz.id})"><i class="fa-solid fa-share-nodes me-2 text-success"></i> Chia sẻ</button></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><button class="dropdown-item" onclick="openMoveModal(${quiz.id})"><i class="fa-solid fa-folder-open me-2 text-secondary"></i> Di chuyển</button></li>
                    <li><button class="dropdown-item" onclick="editQuizTitle(${quiz.id})"><i class="fa-solid fa-pen me-2 text-warning"></i> Đổi tên</button></li>
                    <li><button class="dropdown-item text-danger" onclick="deleteQuiz(${quiz.id})"><i class="fa-solid fa-trash me-2"></i> Xóa</button></li>
                </ul>
            </div>
        </div>`;
    return quizItem;
}

// === CÁC CHỨC NĂNG API ===
function switchFolder(folderId) { currentViewFolderId = folderId; renderCurrentView(); }

async function createFolder(token) {
    const name = document.getElementById('new-folder-name').value.trim();
    if (!name) return alert("Nhập tên thư mục");
    try {
        const res = await fetch('http://127.0.0.1:8000/folders', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name })
        });
        if (res.ok) { document.getElementById('new-folder-name').value = ''; createFolderModal.hide(); refreshData(token); }
    } catch (err) { console.error(err); }
}

async function deleteFolder(folderId) {
    if (!confirm("Xóa thư mục? Quiz sẽ chuyển ra ngoài.")) return;
    const token = localStorage.getItem('quizAIToken');
    try {
        const res = await fetch(`http://127.0.0.1:8000/folders/${folderId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) refreshData(token);
    } catch (err) { console.error(err); }
}

function openMoveModal(quizId) {
    quizIdToMove = quizId;
    const select = document.getElementById('move-folder-select');
    select.innerHTML = '<option value="">(Thư mục gốc)</option>';
    allFolders.forEach(f => { if (f.id !== currentViewFolderId) select.innerHTML += `<option value="${f.id}">${escapeHTML(f.name)}</option>`; });
    moveQuizModal.show();
}

async function confirmMoveQuiz(token) {
    const targetId = document.getElementById('move-folder-select').value || null;
    try {
        const res = await fetch(`http://127.0.0.1:8000/quizzes/${quizIdToMove}/move`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ folder_id: targetId ? parseInt(targetId) : null })
        });
        if (res.ok) { moveQuizModal.hide(); refreshData(token); }
    } catch (err) { console.error(err); }
}

// Hàm mở Modal Start (Đã sửa để reset form)
function openStartModal(id, title) {
    quizIdToStart = id;
    document.getElementById('modal-quiz-title').innerText = title;
    document.getElementById('modePractice').checked = true;
    document.getElementById('timer-input-section').classList.add('d-none');
    // Mặc định bật trộn
    document.getElementById('shuffleQuestions').checked = true;
    document.getElementById('shuffleAnswers').checked = true;
    startQuizModal.show();
}

function viewQuiz(id) {
    const quiz = allQuizzes.find(q => q.id === id);
    if (!quiz) return;
    document.getElementById('viewQuizModalLabel').innerText = `Nội dung: ${escapeHTML(quiz.title)}`;
    const body = document.getElementById('viewQuizModalBody');
    body.innerHTML = '';
    quiz.questions.forEach((q, i) => {
        body.innerHTML += `<div class="quiz-question"><h4>Câu ${i + 1}: ${escapeHTML(q.question_text)}</h4><ul>
            <li class="${q.correct_answer === 'A' ? 'correct-answer' : ''}">A: ${escapeHTML(q.choice_a)}</li>
            <li class="${q.correct_answer === 'B' ? 'correct-answer' : ''}">B: ${escapeHTML(q.choice_b)}</li>
            <li class="${q.correct_answer === 'C' ? 'correct-answer' : ''}">C: ${escapeHTML(q.choice_c)}</li>
            <li class="${q.correct_answer === 'D' ? 'correct-answer' : ''}">D: ${escapeHTML(q.choice_d)}</li>
        </ul></div>`;
    });
    viewModal.show();
}

function shareQuiz(id) {
    const url = new URL(`do_quiz.html?quiz_id=${id}`, window.location.href).href;
    try { navigator.clipboard.writeText(url); alert("Đã copy link!"); } catch { prompt("Copy link:", url); }
}

async function editQuizTitle(id) {
    const quiz = allQuizzes.find(q => q.id === id);
    const newTitle = prompt("Tên mới:", quiz.title);
    if (!newTitle || newTitle === quiz.title) return;
    const token = localStorage.getItem('quizAIToken');
    const res = await fetch(`http://127.0.0.1:8000/quizzes/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ title: newTitle })
    });
    if (res.ok) refreshData(token);
}

async function deleteQuiz(id) {
    if (!confirm("Xóa quiz này?")) return;
    const token = localStorage.getItem('quizAIToken');
    const res = await fetch(`http://127.0.0.1:8000/quizzes/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) refreshData(token);
}

function downloadDocx(quizId) { window.location.href = `http://127.0.0.1:8000/quizzes/${quizId}/export/docx`; }

// ✅ MỚI THÊM: HÀM TOGGLE FAVORITE
async function toggleFavorite(event, quizId) {
    event.stopPropagation(); // Ngăn click vào xem chi tiết
    const token = localStorage.getItem('quizAIToken');
    const icon = document.getElementById(`fav-icon-${quizId}`);
    
    // Hiệu ứng giả lập ngay lập tức cho mượt
    const isCurrentlyFav = icon.classList.contains('fa-solid');
    if (isCurrentlyFav) {
        icon.className = 'fa-regular fa-heart text-muted fs-4';
    } else {
        icon.className = 'fa-solid fa-heart text-danger fs-4 animate__animated animate__heartBeat';
    }

    try {
        await fetch(`http://127.0.0.1:8000/quizzes/${quizId}/favorite`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // Cập nhật lại dữ liệu cục bộ
        const quiz = allQuizzes.find(q => q.id === quizId);
        if (quiz) quiz.is_favorite = !quiz.is_favorite;
    } catch (err) { 
        console.error(err);
        // Hoàn tác nếu lỗi
        icon.className = isCurrentlyFav ? 'fa-solid fa-heart text-danger fs-4' : 'fa-regular fa-heart text-muted fs-4';
    }
}

function escapeHTML(str) { if (typeof str !== 'string') return ''; return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m])); }
function formatTimeAgo(dateString) { return "Vừa xong"; } // Giữ gọn, bạn có thể dùng hàm format cũ