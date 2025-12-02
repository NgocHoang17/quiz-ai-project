// === BIẾN TOÀN CỤC ===
let allQuizzes = []; 
let allFolders = []; 
let currentViewFolderId = null; // null = Thư mục gốc
let quizIdToMove = null;
let quizIdToStart = null;

// Modal instances
let viewModal, startQuizModal, createFolderModal, moveQuizModal;

document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');

    if (!token) { window.location.href = 'login.html'; return; }
    
    // Init Modals
    viewModal = new bootstrap.Modal(document.getElementById('viewQuizModal'));
    startQuizModal = new bootstrap.Modal(document.getElementById('startQuizOptionsModal'));
    createFolderModal = new bootstrap.Modal(document.getElementById('createFolderModal'));
    moveQuizModal = new bootstrap.Modal(document.getElementById('moveQuizModal'));
    
    document.getElementById('welcome-message').innerText = `Chào, ${email}`;
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.clear(); window.location.href = 'login.html';
    });

    // Load Data
    refreshData(token);

    // Event Listeners
    document.getElementById('start-quiz-button').addEventListener('click', function() {
        const shuffleQ = document.getElementById('modal-shuffle-questions').checked;
        const shuffleC = document.getElementById('modal-shuffle-choices').checked;
        if (quizIdToStart) window.location.href = `do_quiz.html?quiz_id=${quizIdToStart}&shuffle_q=${shuffleQ}&shuffle_c=${shuffleC}`;
    });

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
    } catch (err) {
        console.error("Lỗi tải dữ liệu:", err);
    } finally {
        document.getElementById('loading-indicator').style.display = 'none';
    }
}

// === HIỂN THỊ GIAO DIỆN (Folders + Quizzes) ===

function renderCurrentView() {
    const folderContainer = document.getElementById('folders-container');
    const quizContainer = document.getElementById('quiz-list-container');
    const breadcrumb = document.getElementById('folder-breadcrumb');
    const emptyMsg = document.getElementById('empty-msg');
    const divider = document.getElementById('folder-divider');

    folderContainer.innerHTML = '';
    quizContainer.innerHTML = '';
    
    // 1. Breadcrumb
    if (currentViewFolderId === null) {
        breadcrumb.innerHTML = `<li class="breadcrumb-item active">Thư mục gốc</li>`;
    } else {
        const currentFolder = allFolders.find(f => f.id === currentViewFolderId);
        const folderName = currentFolder ? currentFolder.name : "Thư mục";
        breadcrumb.innerHTML = `
            <li class="breadcrumb-item"><a href="#" onclick="switchFolder(null)">Thư mục gốc</a></li>
            <li class="breadcrumb-item active">${escapeHTML(folderName)}</li>
        `;
    }

    // 2. Folders (Chỉ hiện ở Root)
    let hasFolders = false;
    if (currentViewFolderId === null) {
        allFolders.forEach(folder => {
            hasFolders = true;
            folderContainer.innerHTML += `
                <div class="col-6 col-md-4 col-lg-3">
                    <div class="card folder-card h-100 p-3 text-center" onclick="switchFolder(${folder.id})">
                        <i class="fa-solid fa-folder folder-icon mb-2"></i>
                        <h6 class="text-truncate" title="${escapeHTML(folder.name)}">${escapeHTML(folder.name)}</h6>
                        <button class="btn btn-outline-danger btn-sm mt-2 py-0 px-2" onclick="event.stopPropagation(); deleteFolder(${folder.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
    }

    // 3. Quizzes (Lọc theo folder hiện tại)
    const quizzesInView = allQuizzes.filter(q => q.folder_id === currentViewFolderId);
    
    quizzesInView.forEach(quiz => {
        // ✅ GỌI HÀM createQuizElement ĐỂ TẠO GIAO DIỆN MENU 3 CHẤM
        const quizElement = createQuizElement(quiz);
        quizContainer.appendChild(quizElement);
    });

    // 4. Trạng thái trống
    divider.style.display = (hasFolders && quizzesInView.length > 0) ? 'block' : 'none';
    if (!hasFolders && quizzesInView.length === 0) {
        emptyMsg.style.display = 'block';
    } else {
        emptyMsg.style.display = 'none';
    }
}

// === ✅ HÀM TẠO HTML QUIZ (CÓ DROPDOWN MENU) ===
function createQuizElement(quiz) {
    const quizItem = document.createElement('div');
    quizItem.id = `quiz-item-${quiz.id}`; 
    quizItem.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';

    const timeAgo = formatTimeAgo(quiz.created_at);

    quizItem.innerHTML = `
        <div class="flex-grow-1" onclick="viewQuiz(${quiz.id})" style="cursor: pointer;">
            <h5 class="mb-1 text-primary fw-bold text-decoration-none">
                <i class="fa-regular fa-file-lines me-2"></i>${escapeHTML(quiz.title)}
            </h5>
            <small class="text-muted">
                <i class="fa-solid fa-layer-group me-1"></i> ${quiz.questions.length} câu &bull; 
                <i class="fa-regular fa-clock me-1"></i> ${timeAgo}
            </small>
        </div>

        <div class="d-flex align-items-center gap-2">
            <button class="btn btn-primary btn-sm" onclick="startQuiz(${quiz.id})">
                <i class="fa-solid fa-play me-1"></i> Làm bài
            </button>

            <div class="dropdown">
                <button class="btn btn-light btn-sm border" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow">
                    <li>
                        <a class="dropdown-item" href="flashcard.html?quiz_id=${quiz.id}">
                            <i class="fa-solid fa-layer-group me-2 text-warning"></i> Học Flashcard
                        </a>
                    </li>
                    <li>
                        <button class="dropdown-item" onclick="viewQuiz(${quiz.id})">
                            <i class="fa-solid fa-eye me-2 text-info"></i> Xem chi tiết
                        </button>
                    </li>
                    <li>
                        <button class="dropdown-item" onclick="shareQuiz(${quiz.id})">
                            <i class="fa-solid fa-share-nodes me-2 text-success"></i> Chia sẻ
                        </button>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                        <button class="dropdown-item" onclick="openMoveModal(${quiz.id})">
                            <i class="fa-solid fa-folder-open me-2 text-secondary"></i> Di chuyển
                        </button>
                    </li>
                    <li>
                        <button class="dropdown-item" onclick="editQuizTitle(${quiz.id})">
                            <i class="fa-solid fa-pen me-2 text-warning"></i> Đổi tên
                        </button>
                    </li>
                    <li>
                        <button class="dropdown-item text-danger" onclick="deleteQuiz(${quiz.id})">
                            <i class="fa-solid fa-trash me-2"></i> Xóa
                        </button>
                    </li>
                </ul>
            </div>
        </div>
    `;
    return quizItem;
}

// Chuyển folder
function switchFolder(folderId) {
    currentViewFolderId = folderId;
    renderCurrentView();
}

// === CÁC CHỨC NĂNG (API) ===

async function createFolder(token) {
    const nameInput = document.getElementById('new-folder-name');
    const name = nameInput.value.trim();
    if (!name) return alert("Vui lòng nhập tên thư mục");

    try {
        const res = await fetch('http://127.0.0.1:8000/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: name })
        });
        if (res.ok) {
            nameInput.value = '';
            createFolderModal.hide();
            refreshData(token);
        } else {
            alert("Lỗi tạo thư mục");
        }
    } catch (err) { console.error(err); }
}

async function deleteFolder(folderId) {
    if (!confirm("Xóa thư mục này? Các quiz bên trong sẽ được chuyển ra ngoài.")) return;
    const token = localStorage.getItem('quizAIToken');
    try {
        const res = await fetch(`http://127.0.0.1:8000/folders/${folderId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) refreshData(token);
    } catch (err) { console.error(err); }
}

function openMoveModal(quizId) {
    quizIdToMove = quizId;
    const select = document.getElementById('move-folder-select');
    select.innerHTML = '<option value="">(Thư mục gốc)</option>';
    
    allFolders.forEach(f => {
        if (f.id !== currentViewFolderId) {
            select.innerHTML += `<option value="${f.id}">${escapeHTML(f.name)}</option>`;
        }
    });
    moveQuizModal.show();
}

async function confirmMoveQuiz(token) {
    const folderId = document.getElementById('move-folder-select').value;
    const targetId = folderId === "" ? null : parseInt(folderId);

    try {
        const res = await fetch(`http://127.0.0.1:8000/quizzes/${quizIdToMove}/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ folder_id: targetId })
        });
        if (res.ok) {
            moveQuizModal.hide();
            refreshData(token);
        } else {
            alert("Lỗi di chuyển quiz");
        }
    } catch (err) { console.error(err); }
}

// --- CÁC HÀM CŨ ---

function startQuiz(id) { quizIdToStart = id; startQuizModal.show(); }

function viewQuiz(id) {
    const quiz = allQuizzes.find(q => q.id === id);
    if (!quiz) return;
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
            </div>`;
    });
    viewModal.show();
}

function shareQuiz(id) {
    const shareUrl = `do_quiz.html?quiz_id=${id}`;
    const fullShareUrl = new URL(shareUrl, window.location.href).href;
    try { navigator.clipboard.writeText(fullShareUrl); alert("Đã copy link!"); } 
    catch (e) { prompt("Copy link:", fullShareUrl); }
}

async function editQuizTitle(id) {
    const quiz = allQuizzes.find(q => q.id === id);
    const newTitle = prompt("Tên mới:", quiz.title);
    if (!newTitle || newTitle === quiz.title) return;
    const token = localStorage.getItem('quizAIToken');
    const res = await fetch(`http://127.0.0.1:8000/quizzes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle })
    });
    if (res.ok) refreshData(token);
}

async function deleteQuiz(id) {
    if (!confirm("Xóa quiz này?")) return;
    const token = localStorage.getItem('quizAIToken');
    const res = await fetch(`http://127.0.0.1:8000/quizzes/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) refreshData(token);
}

// Utils
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function(m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]; });
}
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return "Vừa xong";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
}