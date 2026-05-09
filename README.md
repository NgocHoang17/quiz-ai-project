# QuizAI - Nền tảng Tạo Đề Trắc Nghiệm Thông Minh 🤖

QuizAI là một ứng dụng web tự động tạo bộ câu hỏi trắc nghiệm từ văn bản và tài liệu (PDF, Word) sử dụng mô hình Generative AI (Google Gemini). Ứng dụng giúp số hóa quá trình soạn đề và cung cấp môi trường ôn tập tương tác cho người dùng.

##  Tính năng nổi bật
- **Tạo Quiz tự động bằng AI:** Sinh câu hỏi trắc nghiệm, điền khuyết từ đoạn văn bản hoặc file upload (hỗ trợ kéo thả).
- **Lý giải thông minh:** AI tự động trích xuất nguyên văn tài liệu và giải thích chi tiết lý do chọn đáp án đúng.
- **Quản lý thư viện học tập:** Lưu trữ, tổ chức các bộ câu hỏi theo thư mục cá nhân.
- **Chế độ Luyện tập & Thi:** Làm bài trắc nghiệm có đồng hồ bấm giờ, xáo trộn câu hỏi.
- **Dashboard Thống kê:** Theo dõi tiến độ học tập, lịch sử điểm số trực quan bằng biểu đồ.

## 🛠️ Công nghệ sử dụng
- **Backend:** Python (FastAPI), SQLAlchemy (ORM), JWT Authentication.
- **Frontend:** HTML5, CSS3, Vanilla JavaScript, Bootstrap 5, Chart.js.
- **Database:** MySQL.
- **AI Integration:** Google Gemini API (`gemini-2.5-flash`).
- **Xử lý File:** `PyMuPDF` (PDF), `python-docx` (Word).

##  Hướng dẫn Cài đặt & Chạy dự án

**1. Yêu cầu hệ thống**
- Python 3.9+
- MySQL Server đang hoạt động.

**2. Cài đặt thư viện**
Mở terminal tại thư mục dự án và chạy lệnh:
```bash
pip install -r requirements.txt
```
**3. Cấu hình Cơ sở dữ liệu và API Key**
- Tạo một Database trống trong MySQL (ví dụ: quizai_db).
- Mở file backend/database.py để cấu hình lại chuỗi kết nối MySQL:
*mysql+mysqlconnector://<username>:<password>@localhost/<tên_database>*
- Cung cấp API Key của Google Gemini trong source code.
  
**4. Khởi động Server**
- Vào mt ảo:
```bash
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\venv\Scripts\activate
```
- Chạy ứng dụng:
```bash
uvicorn backend.main:app --reload
```

**5. Mở Frontend**
