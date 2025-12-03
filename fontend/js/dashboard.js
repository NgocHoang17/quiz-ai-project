document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');

    // 1. Auth Guard
    if (!token) {
        window.location.href = 'login.html';
        return; 
    }
    document.getElementById('welcome-message').innerText = `Xin chào, ${email}`;

    // 2. Logout Logic
    document.getElementById('logout-button').addEventListener('click', function() {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // 3. Load Data
    loadDashboardStats(token);
    loadRecentQuizzes(token);
});

// Hàm tải thống kê & Vẽ biểu đồ
async function loadDashboardStats(token) {
    try {
        const response = await fetch('http://127.0.0.1:8000/dashboard-stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const stats = await response.json();
            
            // Điền số liệu vào Cards
            animateValue("stat-total-quizzes", 0, stats.total_quizzes, 1000);
            animateValue("stat-total-questions", 0, stats.total_questions_answered, 1000);
            animateValue("stat-total-correct", 0, stats.total_correct, 1000);
            animateValue("stat-total-incorrect", 0, stats.total_incorrect, 1000);

            // Vẽ biểu đồ
            drawChart(stats.total_correct, stats.total_incorrect);
        }
    } catch (err) {
        console.error("Lỗi tải dashboard stats:", err);
    }
}

// Hàm tải danh sách Quiz gần đây
async function loadRecentQuizzes(token) {
    try {
        const response = await fetch('http://127.0.0.1:8000/recent-quizzes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const listContainer = document.getElementById('recent-quiz-list');
        listContainer.innerHTML = '';

        if (response.ok) {
            const quizzes = await response.json();
            
            if (quizzes.length === 0) {
                listContainer.innerHTML = '<div class="p-3 text-center text-muted">Bạn chưa có hoạt động nào.</div>';
                return;
            }

            quizzes.forEach(quiz => {
                const item = document.createElement('a');
                item.href = `my_quizzes.html`; // 
                item.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
                
                const date = new Date(quiz.created_at).toLocaleDateString('vi-VN');
                
                item.innerHTML = `
                    <div>
                        <div class="fw-bold text-dark">${quiz.title}</div>
                        <small class="text-muted"><i class="fa-regular fa-clock me-1"></i>${date}</small>
                    </div>
                    <span class="badge bg-primary rounded-pill">${quiz.questions.length} câu</span>
                `;
                listContainer.appendChild(item);
            });
        }
    } catch (err) {
        console.error("Lỗi tải recent quizzes:", err);
    }
}

// Hàm vẽ biểu đồ tròn
function drawChart(correct, incorrect) {
    const ctx = document.getElementById('accuracyChart').getContext('2d');
    
    // Nếu chưa có dữ liệu thì hiện màu xám
    let data = [correct, incorrect];
    let colors = ['#1cc88a', '#f6c23e']; // Xanh, Vàng
    
    if (correct + incorrect === 0) {
        data = [1]; 
        colors = ['#e3e6f0']; // Xám
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Đúng', 'Sai/Chưa làm'],
            datasets: [{
                data: data,
                backgroundColor: colors,
                hoverBackgroundColor: colors,
                hoverBorderColor: "rgba(234, 236, 244, 1)",
            }],
        },
        options: {
            maintainAspectRatio: false,
            tooltips: {
                backgroundColor: "rgb(255,255,255)",
                bodyFontColor: "#858796",
                borderColor: '#dddfeb',
                borderWidth: 1,
                xPadding: 15,
                yPadding: 15,
                displayColors: false,
                caretPadding: 10,
            },
            legend: {
                display: false
            },
            cutout: '70%',
        },
    });
}

// Hiệu ứng số chạy (cho đẹp)
function animateValue(id, start, end, duration) {
    if (start === end) return;
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    const obj = document.getElementById(id);
    const timer = setInterval(function() {
        current += increment;
        obj.innerHTML = current;
        if (current == end) {
            clearInterval(timer);
        }
    }, stepTime);
}