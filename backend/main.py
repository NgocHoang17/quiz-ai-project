from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile
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
from pydantic import BaseModel
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


# --- (TÁI CẤU TRÚC) HÀM LÕI AI ---
def _generate_quiz_from_text(text: str):
    """
    Hàm lõi: Nhận văn bản, gọi AI và trả về (data, error).
    """
    try:
        model = genai.GenerativeModel("gemini-2.5-flash") 
        
        prompt = f"""
        Dựa vào đoạn văn bản sau: "{text}"
        Hãy tạo 5 câu hỏi trắc nghiệm (A, B, C, D) và chỉ rõ đáp án đúng.
        Trả về CHUỖI JSON hợp lệ, KHÔNG thêm giải thích.
        Định dạng:
        [
          {{"cau_hoi": "?", "lua_chon": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "dap_an": "A"}}
        ]
        """
        response = model.generate_content(prompt)
        quiz_json_string = response.text.strip().replace("```json", "").replace("```", "").strip()
        
        try:
            quiz_data = json.loads(quiz_json_string)
            return quiz_data, None # Trả về (data, không có lỗi)
        except json.JSONDecodeError:
            return None, "AI trả về định dạng JSON không hợp lệ."

    except Exception as e:
        print(f"❌ Lỗi khi gọi Gemini API: {e}")
        return None, f"Lỗi khi gọi Gemini API: {str(e)}"

# --- API QUIZ (TẠO VÀ LƯU) ---

class QuizRequest(BaseModel):
    text: str

@app.post("/generate-quiz") # API cũ (dùng cho dán văn bản)
def generate_quiz_from_text(request: QuizRequest):
    input_text = request.text.strip()
    if not input_text:
        return {"error": "Vui lòng nhập nội dung văn bản."}

    quiz_data, error = _generate_quiz_from_text(input_text)
    
    if error:
        return {"error": error}
    return {"quiz_data": quiz_data}

# === API MỚI: TẠO QUIZ TỪ FILE UPLOAD (ĐÃ CẬP NHẬT) ===
@app.post("/upload-quiz-file")
async def generate_quiz_from_file(file: UploadFile = File(...)):
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
    quiz_data, error = _generate_quiz_from_text(extracted_text)
    
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