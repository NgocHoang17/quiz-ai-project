from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from pydantic import BaseModel
import google.generativeai as genai
import json

# --- TẢI BIẾN MÔI TRƯỜNG ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("LỖI: Không tìm thấy GEMINI_API_KEY trong file .env")
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("Đã cấu hình thành công Google AI (Gemini v1).")
    except Exception as e:
        print(f"Lỗi khi cấu hình Google AI: {e}")

# --- KHỞI TẠO ỨNG DỤNG FASTAPI ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cho phép tất cả các domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ĐỊNH NGHĨA DỮ LIỆU ĐẦU VÀO ---
class QuizRequest(BaseModel):
    text: str

# --- API GỐC ---
@app.get("/")
def read_root():
    return {"message": "Chào mừng đến với QuizAI Backend (Gemini v1 - FastAPI)"}

# --- API TẠO QUIZ ---
@app.post("/generate-quiz")
def generate_quiz(request: QuizRequest):
    input_text = request.text.strip()

    if not input_text:
        return {"error": "Vui lòng nhập nội dung văn bản."}

    try:
        # Chọn model chuẩn của Gemini v1 (không còn v1beta)
        model = genai.GenerativeModel("gemini-2.5-flash")

        prompt = f"""
        Dựa vào đoạn văn bản sau:
        "{input_text}"

        Hãy tạo 5 câu hỏi trắc nghiệm (multiple choice).
        Mỗi câu có 4 lựa chọn (A, B, C, D) và chỉ rõ đáp án đúng.

        Trả về CHUỖI JSON hợp lệ, KHÔNG thêm văn bản giải thích bên ngoài.
        Định dạng:
        [
          {{
            "cau_hoi": "Câu hỏi?",
            "lua_chon": {{
              "A": "...",
              "B": "...",
              "C": "...",
              "D": "..."
            }},
            "dap_an": "A"
          }}
        ]
        """

        response = model.generate_content(prompt)

        quiz_json_string = response.text.strip()

        # Làm sạch nếu AI trả về có markdown (```json ... ```)
        quiz_json_string = quiz_json_string.replace("```json", "").replace("```", "").strip()

        # Kiểm tra JSON hợp lệ trước khi trả về
        try:
            quiz_data = json.loads(quiz_json_string)
        except json.JSONDecodeError:
            quiz_data = quiz_json_string  # Trả chuỗi thô nếu JSON sai

        return {"quiz_data": quiz_data}

    except Exception as e:
        print(f"❌ Lỗi khi gọi Gemini API: {e}")
        return {"error": f"Lỗi khi gọi Gemini API: {str(e)}"}
