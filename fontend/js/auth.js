const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authMessage = document.getElementById('auth-message');

// HÀM XỬ LÝ LỖI ĐĂNG NHẬP 
function handleAuthError(data) {
    authMessage.className = 'auth-message text-danger'; // Hiển thị màu đỏ
    
    if (data.detail) {
        if (typeof data.detail === 'string') {
            // Lỗi 400/401 (ví dụ: "Email hoặc mật khẩu không chính xác", "Email đã được đăng ký")
            authMessage.innerText = data.detail;
        } else if (Array.isArray(data.detail)) {
            // Lỗi 422 (Validation) từ Pydantic
            let errorMsg = data.detail[0].msg;
            
            // Tự dịch một số lỗi Pydantic phổ biến sang tiếng Việt
            if (errorMsg.includes("at most 72 characters")) {
                authMessage.innerText = 'Lỗi: Mật khẩu quá dài (tối đa 72 ký tự).';
            } else if (errorMsg.includes("at least 6 characters")) {
                authMessage.innerText = 'Lỗi: Mật khẩu quá ngắn (ít nhất 6 ký tự).';
            } else if (errorMsg.includes("value is not a valid email address")) {
                 authMessage.innerText = 'Lỗi: Email không đúng định dạng.';
            } else {
                authMessage.innerText = 'Lỗi: Dữ liệu không hợp lệ.';
            }
        }
    } else {
        authMessage.innerText = 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.';
    }
}

//  HÀM HIỂN THỊ THÀNH CÔNG 
function handleAuthSuccess(message) {
    authMessage.className = 'auth-message text-success'; // Hiển thị màu xanh
    authMessage.innerText = message;
}

//  Xử lý Đăng ký 
if (registerForm) {
    registerForm.addEventListener('submit', async function(e) { // Chuyển sang async
        e.preventDefault();
        authMessage.innerText = ''; // Xóa thông báo cũ
        
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const response = await fetch('http://127.0.0.1:8000/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            });

            const data = await response.json(); // Lấy JSON
            
            if (!response.ok) {
                // Nếu server trả về 4xx, 5xx (lỗi)
                handleAuthError(data);
            } else {
                // Nếu server trả về 2xx (thành công)
                handleAuthSuccess('Đăng ký thành công! Đang chuyển đến trang đăng nhập...');
                registerForm.reset();
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            }
        } catch (err) {
            // Lỗi mạng (server sập, mất kết nối)
            handleAuthError({ detail: "Lỗi kết nối. Không thể liên lạc với máy chủ." });
        }
    });
}

// -- Xử lý Đăng nhập --
if (loginForm) {
    loginForm.addEventListener('submit', async function(e) { // Chuyển sang async
        e.preventDefault();
        authMessage.innerText = ''; // Xóa thông báo cũ
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        try {
            const response = await fetch('http://127.0.0.1:8000/login', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json(); // Lấy JSON

            if (!response.ok) {
                // Lỗi (sai pass, user không tồn tại)
                handleAuthError(data);
            } else {
                // ĐĂNG NHẬP THÀNH CÔNG!
                localStorage.setItem('quizAIToken', data.access_token);
                localStorage.setItem('quizAIUserEmail', email);
                
                // Chuyển hướng đến trang chính
                window.location.href = 'dashboard.html';
            }
        } catch (err) {
            // Lỗi mạng
            handleAuthError({ detail: "Lỗi kết nối. Không thể liên lạc với máy chủ." });
        }
    });
}

//  ẨN / HIỆN MẬT KHẨU 
function togglePassword(inputId, toggleElement) {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';

    // Đổi type
    input.type = isPassword ? 'text' : 'password';

    // Đổi class để thay icon
    if (isPassword) {
        toggleElement.classList.add('show');
    } else {
        toggleElement.classList.remove('show');
    }
}