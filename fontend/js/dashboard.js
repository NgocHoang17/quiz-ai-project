document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('quizAIToken');
    const email = localStorage.getItem('quizAIUserEmail');

    if (!token) { window.location.href = 'login.html'; return; }
    
    // Set tên người dùng
    const namePart = email.split('@')[0];
    // Viết hoa chữ cái đầu
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    document.getElementById('welcome-message').innerHTML = `Xin chào, ${formattedName}! 👋`;

    // Logout logic
    document.getElementById('logout-button').addEventListener('click', function() {
        localStorage.clear(); window.location.href = 'login.html';
    });

    loadDashboardStats(token);
    loadRecentQuizzes(token);
    
// Vẽ mặc định là tuần (week)
    drawActivityChart(token, 'week'); 

    // ✅ BẮT SỰ KIỆN THAY ĐỔI THỜI GIAN
    document.getElementById('chart-period-select').addEventListener('change', function() {
        const selectedPeriod = this.value; // 'week' hoặc 'month'
        drawActivityChart(token, selectedPeriod);
    }); 
});

async function loadDashboardStats(token) {
    try {
        const response = await fetch('http://127.0.0.1:8000/dashboard-stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const stats = await response.json();
            
            // Hiệu ứng số chạy (nếu muốn) hoặc gán thẳng
            document.getElementById("stat-total-quizzes").innerText = stats.total_quizzes;
            document.getElementById("stat-total-questions").innerText = stats.total_questions_answered;
            document.getElementById("stat-total-correct").innerText = stats.total_correct;
            
            // Tính % chính xác
            const total = stats.total_correct + stats.total_incorrect;
            const acc = total === 0 ? 0 : Math.round((stats.total_correct / total) * 100);
            document.getElementById("stat-accuracy").innerText = `${acc}%`;

            drawAccuracyChart(stats.total_correct, stats.total_incorrect);
        }
    } catch (err) { console.error(err); }
}

// 1. Biểu đồ Tròn (Accuracy)
function drawAccuracyChart(correct, incorrect) {
    const ctx = document.getElementById('accuracyChart');
    if (!ctx) return; 

    // Nếu chưa làm gì thì hiển thị xám
    let data = [correct, incorrect];
    let colors = ['#00b894', '#ff7675']; // Xanh lá, Đỏ nhạt
    if (correct + incorrect === 0) {
        data = [1]; colors = ['#dfe6e9']; 
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Đúng', 'Sai'],
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10 } }
            },
            cutout: '75%', // Lỗ tròn to hơn cho đẹp
        }
    });
}

// === 2. BIỂU ĐỒ CỘT GHÉP (SIDE-BY-SIDE) ===
// Thêm tham số period (mặc định là 'week')
async function drawActivityChart(token, period = 'week') {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // 1. TẠO GRADIENT MÀU SẮC (Bí quyết cho sự sang chảnh)
    // Gradient Tím (Cho Quiz)
    const gradientPurple = ctx.createLinearGradient(0, 0, 0, 400);
    gradientPurple.addColorStop(0, '#6a11cb'); // Tím đậm ở trên
    gradientPurple.addColorStop(1, 'rgba(106, 17, 203, 0.05)'); // Mờ dần xuống dưới

    // Gradient Xanh (Cho Câu hỏi)
    const gradientGreen = ctx.createLinearGradient(0, 0, 0, 400);
    gradientGreen.addColorStop(0, '#00b894'); // Xanh ngọc ở trên
    gradientGreen.addColorStop(1, 'rgba(0, 184, 148, 0.05)'); // Mờ dần xuống dưới

    const chartType = period === 'week' ? 'bar' : 'line';

    try {
        const response = await fetch(`http://127.0.0.1:8000/activity-chart?time_range=${period}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();

            const existingChart = Chart.getChart("activityChart");
            if (existingChart) existingChart.destroy();

            new Chart(ctx, {
                type: chartType,
                data: {
                    labels: data.labels,
                    datasets: [
                        {
                            label: 'Quiz đã tạo',
                            data: data.created,
                            backgroundColor: period === 'week' ? '#6a11cb' : gradientPurple, // Cột thì màu đặc, Dòng thì gradient
                            borderColor: '#6a11cb',
                            borderWidth: period === 'week' ? 0 : 3, // Dòng thì viền dày
                            
                            // Cấu hình Line
                            pointRadius: 0, // Ẩn điểm tròn mặc định cho sạch
                            pointHoverRadius: 6, // Hiện to khi di chuột
                            pointBackgroundColor: '#fff', // Điểm màu trắng
                            pointBorderColor: '#6a11cb', // Viền tím
                            pointBorderWidth: 2,
                            tension: 0.4, // Đường cong mềm mại
                            fill: true, // Tô màu nền

                            // Cấu hình Bar
                            borderRadius: 6, // Bo góc cột
                            barPercentage: 0.5, // Cột mảnh mai hơn
                            hoverBackgroundColor: '#8e44ad' // Đổi màu khi hover cột
                        },
                        {
                            label: 'Câu hỏi đã ôn',
                            data: data.answered,
                            backgroundColor: period === 'week' ? '#00b894' : gradientGreen,
                            borderColor: '#00b894',
                            borderWidth: period === 'week' ? 0 : 3,

                            // Cấu hình Line
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#fff',
                            pointBorderColor: '#00b894',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true,

                            // Cấu hình Bar
                            borderRadius: 6,
                            barPercentage: 0.5,
                            hoverBackgroundColor: '#55efc4'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: { 
                            position: 'top', 
                            align: 'end', // Đưa chú thích sang phải cho gọn
                            labels: { 
                                usePointStyle: true,
                                boxWidth: 8,
                                font: { family: "'Segoe UI', sans-serif", size: 12 }
                            } 
                        },
                        tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.95)', // Nền trắng
                            titleColor: '#2d3436', // Chữ đen
                            bodyColor: '#636e72',
                            borderColor: 'rgba(0,0,0,0.05)',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8,
                            displayColors: true,
                            boxPadding: 4,
                            callbacks: {
                                label: function(context) {
                                    return ` ${context.dataset.label}: ${context.raw}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { display: false }, // Bỏ lưới dọc
                            ticks: { 
                                maxTicksLimit: period === 'month' ? 10 : 7,
                                maxRotation: 0,
                                color: '#b2bec3',
                                font: { size: 11 }
                            }
                        },
                        y: {
                            beginAtZero: true,
                            border: { display: false }, // Bỏ đường kẻ trục Y
                            grid: { 
                                color: '#f1f2f6', // Màu lưới ngang rất nhạt
                                borderDash: [5, 5] // Nét đứt
                            },
                            ticks: { 
                                precision: 0,
                                color: '#b2bec3',
                                padding: 10
                            }
                        }
                    },
                    animation: {
                        duration: 1500, // Hiệu ứng vẽ chậm rãi
                        easing: 'easeOutQuart'
                    }
                }
            });
        }
    } catch (err) {
        console.error("Lỗi vẽ biểu đồ:", err);
    }
}

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
                listContainer.innerHTML = '<div class="text-center text-muted small">Chưa có hoạt động.</div>';
                return;
            }

            quizzes.forEach(quiz => {
                const item = document.createElement('div');
                item.className = 'd-flex align-items-center mb-3 pb-3 border-bottom';
                // Icon ngẫu nhiên hoặc cố định
                item.innerHTML = `
                    <div class="activity-icon bg-light text-primary">
                        <i class="fa-solid fa-file-lines"></i>
                    </div>
                    <div class="flex-grow-1">
                        <h6 class="mb-0 fw-bold text-dark" style="font-size: 0.9rem;">
                            <a href="my_quizzes.html" class="text-decoration-none text-dark">${escapeHTML(quiz.title)}</a>
                        </h6>
                        <small class="text-muted" style="font-size: 0.75rem;">
                            ${new Date(quiz.created_at).toLocaleDateString('vi-VN')} • ${quiz.questions.length} câu
                        </small>
                    </div>
                    <a href="do_quiz.html?quiz_id=${quiz.id}" class="btn btn-sm btn-outline-primary rounded-pill px-3">
                        <i class="fa-solid fa-play"></i>
                    </a>
                `;
                listContainer.appendChild(item);
            });
        }
    } catch (err) { console.error(err); }
}

function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function(m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]; });
}