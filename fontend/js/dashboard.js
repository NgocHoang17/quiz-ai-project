let startQuizModal, viewModal;
let quizIdToStart = null;

document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('quizAIToken');
    if (!token) { window.location.href = 'login.html'; return; }

    const email = localStorage.getItem('quizAIUserEmail');
    document.getElementById('welcome-message').innerText = `Xin chào, ${email}`;
    document.getElementById('logout-button').addEventListener('click', () => {
        localStorage.clear(); window.location.href = 'login.html';
    });

    // Init Modals
    startQuizModal = new bootstrap.Modal(document.getElementById('startQuizModal'));
    viewModal = new bootstrap.Modal(document.getElementById('viewQuizModal'));

    // Tải dữ liệu
    loadDashboardStats(token);
    drawActivityChart(token, 'week');
    loadHistory(token);
    loadRecentCreated(token);
    loadFavorites(token);

    // Event Listeners
    document.getElementById('chart-period').addEventListener('change', function() {
        drawActivityChart(token, this.value);
    });

    // Setup Logic Modal Start
    setupStartModalLogic();
});

// === 1. HÀM TIỆN ÍCH: ĐỒNG BỘ HIỂN THỊ LOẠI ĐỀ ===
function getQuizTypeBadge(type) {
    // Chuẩn hóa input phòng trường hợp null/undefined
    const safeType = type ? type.toLowerCase() : 'mcq';
    
    let label = '';
    let badgeClass = '';

    switch (safeType) {
        case 'mcq':
            label = 'Trắc nghiệm';
            badgeClass = 'bg-info text-dark bg-opacity-25 border border-info'; 
            break;
        case 'fill_in_blank':
            label = 'Điền khuyết';
            badgeClass = 'bg-warning text-dark bg-opacity-25 border border-warning';
            break;
        case 'exercise':
            label = 'Bài tập';
            badgeClass = 'bg-success text-success bg-opacity-10 border border-success';
            break;
        case 'mixed':
            label = 'Hỗn hợp';
            badgeClass = 'bg-primary text-primary bg-opacity-10 border border-primary';
            break;
        default:
            label = 'Khác';
            badgeClass = 'bg-secondary text-secondary bg-opacity-10 border border-secondary';
    }

    return `<span class="badge ${badgeClass} px-3 py-2 rounded-pill fw-bold" style="font-size: 0.75rem;">${label}</span>`;
}

// === 2. CÁC HÀM TẢI DỮ LIỆU ===

async function loadDashboardStats(token) {
    try {
        const res = await fetch('http://127.0.0.1:8000/dashboard-stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            document.getElementById('stat-total-quiz').innerText = data.total_quizzes;
            document.getElementById('stat-total-completed').innerText = data.total_completed;
            document.getElementById('stat-total-folders').innerText = data.total_folders;
            document.getElementById('stat-total-favorites').innerText = data.total_favorites;
        }
    } catch (err) { console.error(err); }
}

async function drawActivityChart(token, period) {
    const ctx = document.getElementById('activityChart').getContext('2d');
    const gPurple = ctx.createLinearGradient(0,0,0,320); gPurple.addColorStop(0, '#6a11cb'); gPurple.addColorStop(1, 'rgba(106,17,203,0.05)');
    const gGreen = ctx.createLinearGradient(0,0,0,320); gGreen.addColorStop(0, '#00b894'); gGreen.addColorStop(1, 'rgba(0,184,148,0.05)');

    try {
        const res = await fetch(`http://127.0.0.1:8000/activity-chart?time_range=${period}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();

        if (window.myChart) window.myChart.destroy();

        window.myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [
                    { label: 'Đề đã tạo', data: data.created, backgroundColor: gPurple, borderColor: '#6a11cb', borderWidth: 3, tension: 0.4, fill: true },
                    { label: 'Đề đã làm', data: data.taken, backgroundColor: gGreen, borderColor: '#00b894', borderWidth: 3, tension: 0.4, fill: true }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { borderDash: [5,5] } } }
            }
        });
    } catch (err) { console.error(err); }
}

// Tải Lịch sử làm bài
async function loadHistory(token) {
    const tbody = document.getElementById('history-list');
    try {
        const res = await fetch('http://127.0.0.1:8000/quiz-history?limit=5', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        tbody.innerHTML = '';
        data.forEach(item => {
            const dateStr = new Date(item.completed_at).toLocaleDateString('vi-VN');
            const safeTitle = escapeHTML(item.quiz_title); 
            tbody.innerHTML += `
                <tr>
                    <td class="ps-4 fw-bold text-primary">${safeTitle}</td>
                    <td>${item.total_questions} câu</td>
                    <td><span class="badge bg-secondary">${item.score}/10</span></td>
                    <td>${dateStr}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-primary" onclick="openStartModal(${item.quiz_id}, '${safeTitle.replace(/'/g, "\\'")}')">
                            <i class="fa-solid fa-rotate-right me-1"></i>Làm lại
                        </button>
                    </td>
                </tr>`;
        });
        if(data.length === 0) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">Chưa có lịch sử làm bài</td></tr>';
    } catch (err) { console.error(err); }
}

// Tải Lịch sử tạo đề (Đã áp dụng getQuizTypeBadge)
async function loadRecentCreated(token) {
    const tbody = document.getElementById('recent-created-list');
    try {
        const res = await fetch('http://127.0.0.1:8000/recent-quizzes', { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        tbody.innerHTML = '';
        data.forEach(q => {
            const dateStr = new Date(q.created_at).toLocaleDateString('vi-VN');
            
            // SỬ DỤNG HÀM ĐỒNG BỘ LOẠI ĐỀ TẠI ĐÂY
            const typeBadge = getQuizTypeBadge(q.quiz_type);

            tbody.innerHTML += `
                <tr>
                    <td class="ps-4 fw-bold">${escapeHTML(q.title)}</td>
                    <td>${q.questions.length}</td>
                    <td>${typeBadge}</td> 
                    <td>${dateStr}</td>
                </tr>`;
        });
        if(data.length === 0) tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">Chưa tạo đề nào</td></tr>';
    } catch (err) { console.error(err); }
}

// Tải Đề yêu thích (Đã áp dụng getQuizTypeBadge)
async function loadFavorites(token) {
    const tbody = document.getElementById('favorites-list');
    try {
        const res = await fetch('http://127.0.0.1:8000/favorite-quizzes', { headers: { 'Authorization': `Bearer ${token}` } });
        
        if (!res.ok) throw new Error("Lỗi Server");
        
        const data = await res.json();
        tbody.innerHTML = '';
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">Chưa có đề yêu thích</td></tr>';
            return;
        }

        data.forEach(q => {
            const safeTitle = escapeHTML(q.title);
            const jsSafeTitle = safeTitle.replace(/'/g, "\\'");
            const questionCount = q.questions ? q.questions.length : 0;
            
            // SỬ DỤNG HÀM ĐỒNG BỘ LOẠI ĐỀ TẠI ĐÂY
            const typeBadge = getQuizTypeBadge(q.quiz_type);

            tbody.innerHTML += `
                <tr>
                    <td class="ps-4 fw-bold text-danger"><i class="fa-solid fa-heart me-2"></i>${safeTitle}</td>
                    <td>${questionCount}</td>
                    <td>${typeBadge}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-light me-2" onclick="previewQuiz(${q.id})">Xem trước</button>
                        <button class="btn btn-sm btn-primary" onclick="openStartModal(${q.id}, '${jsSafeTitle}')">Làm bài</button>
                    </td>
                </tr>`;
        });
    } catch (err) { 
        console.error("Lỗi tải yêu thích:", err);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-danger">Không tải được dữ liệu</td></tr>`;
    }
}

// --- UTILS ---

function openStartModal(id, title) {
    quizIdToStart = id;
    document.getElementById('modal-quiz-title').innerText = title;
    document.getElementById('modePractice').checked = true;
    document.getElementById('timer-input-section').classList.add('d-none');
    startQuizModal.show();
}

function setupStartModalLogic() {
    document.querySelectorAll('input[name="quizMode"]').forEach(r => {
        r.addEventListener('change', function() {
            document.getElementById('timer-input-section').classList.toggle('d-none', this.value !== 'timer');
        });
    });
    document.getElementById('btn-confirm-start').addEventListener('click', () => {
        const mode = document.querySelector('input[name="quizMode"]:checked').value;
        const time = mode === 'timer' ? document.getElementById('quiz-duration').value : 0;
        const sQ = document.getElementById('shuffleQuestions').checked ? 1 : 0;
        const sA = document.getElementById('shuffleAnswers').checked ? 1 : 0;
        if (quizIdToStart) window.location.href = `do_quiz.html?quiz_id=${quizIdToStart}&time=${time}&shuffle_q=${sQ}&shuffle_a=${sA}`;
    });
}

async function previewQuiz(id) {
    const token = localStorage.getItem('quizAIToken');
    try {
        const res = await fetch(`http://127.0.0.1:8000/quizzes/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const body = document.getElementById('viewQuizModalBody');
        body.innerHTML = '';
        data.questions.forEach((q, i) => {
            body.innerHTML += `
                <div class="mb-3 border-bottom pb-3">
                    <h6 class="fw-bold">Câu ${i+1}: ${escapeHTML(q.question_text)}</h6>
                    <ul class="list-unstyled ps-3 mb-0 text-muted">
                        <li>A. ${escapeHTML(q.choice_a)}</li>
                        <li>B. ${escapeHTML(q.choice_b)}</li>
                        <li>C. ${escapeHTML(q.choice_c)}</li>
                        <li>D. ${escapeHTML(q.choice_d)}</li>
                    </ul>
                </div>`;
        });
        viewModal.show();
    } catch (err) { console.error(err); }
}

function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;'}[m]));
}