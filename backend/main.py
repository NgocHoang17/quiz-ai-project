from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta # === SỬA LỖI 1: Import 'timedelta' ===

# Import tất cả các file .py chúng ta vừa tạo/sửa
from . import models, schemas, security 
from .database import engine, SessionLocal
import google.generativeai as genai
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import json

# --- TẢI BIẾN MÔI TRƯỜNG & CẤU HÌNH AI ---

# === SỬA LỖI 3: Chỉ đường dẫn file .env ở thư mục GỐC (cha) ===
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)
# =======================================================

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
    
    # Dùng 'timedelta' đã import ở trên
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


# --- API QUIZ (TẠO VÀ LƯU) ---

class QuizRequest(BaseModel):
    text: str

@app.post("/generate-quiz") 
def generate_quiz(request: QuizRequest):
    input_text = request.text.strip()
    if not input_text:
        return {"error": "Vui lòng nhập nội dung văn bản."}

    try:
        # === SỬA LỖI 2: Sửa 'GenerModel' thành 'GenerativeModel' ===
        model = genai.GenerativeModel("gemini-1.5-flash") # Dùng model của bạn
        # =======================================================
        
        prompt = f"""
        Dựa vào đoạn văn bản sau: "{input_text}"
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
            return {"quiz_data": quiz_data}
        except json.JSONDecodeError:
            return {"error": "AI trả về định dạng JSON không hợp lệ."}

    except Exception as e:
        print(f"❌ Lỗi khi gọi Gemini API: {e}")
        return {"error": f"Lỗi khi gọi Gemini API: {str(e)}"}


# === API MỚI: LƯU QUIZ (YÊU CẦU ĐĂNG NHẬP) ===
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