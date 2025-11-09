from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import timedelta
import io # Import io để xử lý file bytes
import fitz # Import PyMuPDF (fitz)
import docx # === MỚI: Thư viện Word ===
from pptx import Presentation # === MỚI: Thư viện PowerPoint ===

# Import các file .py của bạn
from . import models, schemas, security 
from .database import engine, SessionLocal
import google.generativeai as genai
from pydantic import BaseModel, Field # ✅ Import thêm Field
from dotenv import load_dotenv
import os
import json

# --- TẢI BIẾN MÔI TRƯỜNG & CẤU HÌNH AI ---
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("❌ LỖI: Không tìm thấy GEMINI_API_KEY")
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("✅ Đã cấu hình thành công Google AI.")
    except Exception as e:
        print(f"❌ Lỗi khi cấu hình Google AI: {e}")

# --- TẠO BẢNG TRONG DATABASE ---
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# --- CẤU HÌNH CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HÀM PHỤ THUỘC (DEPENDENCIES) ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token_data = security.verify_token(token, credentials_exception)
    user = db.query(models.User).filter(models.User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user

# --- API XÁC THỰC (ĐĂNG KÝ & ĐĂNG NHẬP) ---
@app.post("/register", response_model=schemas.UserOut)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email đã được đăng ký")
    
    hashed_password = security.get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


# --- (TÁI CẤU TRÚC) HÀM LÕI AI (ĐÃ CẬP NHẬT PROMPT) ---
def _generate_quiz_from_text(text: str, num_questions: int, quiz_type: str):
    """
    Hàm lõi: Nhận văn bản và tùy chọn, gọi AI và trả về (data, error).
    """
    
    # "Dịch" các tùy chọn sang hướng dẫn cho AI
    quiz_type_instructions = {
        "mcq": "Trắc nghiệm 4 lựa chọn (A, B, C, D).",
        "fill_in_blank": "Trắc nghiệm dạng điền vào chỗ trống. Câu hỏi phải có một dấu ba chấm '...' hoặc '____' để điền.",
        "exercise": "Câu hỏi dạng bài tập vận dụng hoặc giải quyết vấn đề dựa trên nội dung.",
        "mixed": "Hỗn hợp nhiều dạng câu hỏi (trắc nghiệm, điền khuyết, bài tập)."
    }
    
    # Lấy hướng dẫn, nếu không tìm thấy thì dùng mcq làm mặc định
    instruction = quiz_type_instructions.get(quiz_type, quiz_type_instructions["mcq"])

    try:
        model = genai.GenerativeModel("gemini-2.5-flash") 
        
        #  PROMPT ĐÃ ĐƯỢC NÂNG CẤP 
        prompt = f"""
        Dựa vào đoạn văn bản sau đây:
        "{text}"

        Hãy thực hiện 2 yêu cầu sau:
        1. Yêu cầu số lượng: Tạo chính xác {num_questions} câu hỏi.
        2. Yêu cầu loại câu hỏi: {instruction}

        QUY TẮC ĐỊNH DẠNG:
        - Trả về CHUỖI JSON hợp lệ, KHÔNG thêm văn bản giải thích nào bên ngoài.
        - MỖI câu hỏi phải có 4 lựa chọn (A, B, C, D) và 1 đáp án đúng (dù là dạng điền khuyết hay bài tập).
        - Định dạng JSON phải là một danh sách (list) các đối tượng:
        [
          {{
            "cau_hoi": "Câu hỏi 1 ...?",
            "lua_chon": {{
              "A": "Lựa chọn A",
              "B": "Lựa chọn B",
              "C": "Lựa chọn C",
              "D": "Lựa chọn D"
            }},
            "dap_an": "A"
          }},
          {{
            "cau_hoi": "Câu hỏi 2 ...?",
            "lua_chon": {{
              "A": "Lựa chọn A",
              "B": "Lựa chọn B",
              "C": "Lựa chọn C",
              "D": "Lựa chọn D"
            }},
            "dap_an": "B"
          }}
        ]
        """
        response = model.generate_content(prompt)
        quiz_json_string = response.text.strip().replace("```json", "").replace("```", "").strip()
        
        try:
            quiz_data = json.loads(quiz_json_string)
            return quiz_data, None 
        except json.JSONDecodeError:
            print(f"DEBUG: AI trả về JSON không hợp lệ: {quiz_json_string}")
            return None, "AI trả về định dạng JSON không hợp lệ."

    except Exception as e:
        print(f"❌ Lỗi khi gọi Gemini API: {e}")
        return None, f"Lỗi khi gọi Gemini API: {str(e)}"

# --- API QUIZ (TẠO VÀ LƯU) ---

# Cập nhật Schema: Thêm 2 trường mới
class QuizRequest(BaseModel):
    text: str
    num_questions: int = Field(5, gt=0, le=25) # Mặc định là 5, giới hạn 1-25
    quiz_type: str = "mcq" # Mặc định là trắc nghiệm

@app.post("/generate-quiz") 
def generate_quiz_from_text(request: QuizRequest):
    input_text = request.text.strip()
    if not input_text:
        return {"error": "Vui lòng nhập nội dung văn bản."}

    # ✅ Gửi thêm 2 tham số mới
    quiz_data, error = _generate_quiz_from_text(
        request.text, request.num_questions, request.quiz_type
    )
    
    if error:
        return {"error": error}
    return {"quiz_data": quiz_data}

# ✅ Cập nhật API: Thêm 2 tham số mới từ Form
@app.post("/upload-quiz-file")
async def generate_quiz_from_file(
    file: UploadFile = File(...),
    num_questions: int = Form(5), # Nhận từ Form, mặc định là 5
    quiz_type: str = Form("mcq") # Nhận từ Form, mặc định là "mcq"
):
    if not file:
        return {"error": "Vui lòng tải lên một file."}
        
    extracted_text = ""
    file_bytes = await file.read() # Đọc file vào bộ nhớ
    file_extension = os.path.splitext(file.filename)[1].lower() # Lấy đuôi file .pdf, .docx
    
    try:
        # 1. Xử lý file .txt
        if file_extension == ".txt":
            extracted_text = file_bytes.decode("utf-8")
        
        # 2. Xử lý file .pdf
        elif file_extension == ".pdf":
            with fitz.open(stream=io.BytesIO(file_bytes), filetype="pdf") as doc:
                for page in doc:
                    extracted_text += page.get_text()
        
        # 3. === MỚI: Xử lý file .docx (Word) ===
        elif file_extension == ".docx":
            doc_stream = io.BytesIO(file_bytes)
            doc = docx.Document(doc_stream)
            all_text = [p.text for p in doc.paragraphs]
            extracted_text = "\n".join(all_text)
            
        # 4. === MỚI: Xử lý file .pptx (PowerPoint) ===
        elif file_extension == ".pptx":
            ppt_stream = io.BytesIO(file_bytes)
            prs = Presentation(ppt_stream)
            all_text = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"):
                        all_text.append(shape.text)
            extracted_text = "\n".join(all_text)

        else:
            # === CẬP NHẬT: Thông báo lỗi ===
            return {"error": "Định dạng file không được hỗ trợ. Chỉ chấp nhận .txt, .pdf, .docx, .pptx."}
            
    except Exception as e:
        print(f"Lỗi khi đọc file {file.filename}: {e}")
        return {"error": f"Không thể đọc file. Lỗi: {str(e)}"}

    if not extracted_text.strip():
        return {"error": "File không có nội dung hoặc không thể trích xuất văn bản."}
    
    # 5. Gọi hàm AI lõi
    quiz_data, error = _generate_quiz_from_text(
        extracted_text, num_questions, quiz_type
    )
    
    if error:
        return {"error": error}
    return {"quiz_data": quiz_data}


# --- API QUẢN LÝ QUIZ (LƯU, XEM, SỬA, XÓA) ---

@app.post("/save-quiz", response_model=schemas.QuizOut)
def save_quiz(
    quiz_to_save: schemas.QuizCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        new_quiz = models.Quiz(
            title=quiz_to_save.title,
            owner_id=current_user.id 
        )
        db.add(new_quiz)
        db.commit()
        db.refresh(new_quiz)
        
        for q in quiz_to_save.questions:
            new_question = models.Question(
                question_text=q.question_text,
                choice_a=q.choice_a,
                choice_b=q.choice_b,
                choice_c=q.choice_c,
                choice_d=q.choice_d,
                correct_answer=q.correct_answer,
                quiz_id=new_quiz.id
            )
            db.add(new_question)
            
        db.commit() 
        db.refresh(new_quiz)
        
        return new_quiz
        
    except Exception as e:
        db.rollback() 
        print(f"Lỗi khi lưu quiz: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi máy chủ nội bộ: {e}")

@app.get("/my-quizzes", response_model=List[schemas.QuizOut])
def get_user_quizzes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return current_user.quizzes

@app.delete("/quizzes/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ quiz")
    if quiz.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền xóa bộ quiz này")
    db.delete(quiz)
    db.commit()
    return {"message": "Đã xóa quiz thành công"}

@app.put("/quizzes/{quiz_id}", response_model=schemas.QuizOut)
def update_quiz_title(
    quiz_id: int,
    quiz_update: schemas.QuizBase,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ quiz")
    if quiz.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền sửa bộ quiz này")
    
    quiz.title = quiz_update.title
    db.commit()
    db.refresh(quiz)
    return quiz

@app.get("/quiz/{quiz_id}", response_model=schemas.QuizOut)
def get_quiz_details(
    quiz_id: int,
    db: Session = Depends(get_db)
):
    quiz = db.query(models.Quiz).filter(models.Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ quiz")
    return quiz