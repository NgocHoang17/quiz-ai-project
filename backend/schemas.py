from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime # Import datetime

# --- Schemas cho Question (Mới) ---
class QuestionBase(BaseModel):
    question_text: str
    choice_a: str
    choice_b: str
    choice_c: str
    choice_d: str
    correct_answer: str

class QuestionCreate(QuestionBase):
    pass # Khi tạo thì dùng y hệt Base

class QuestionOut(QuestionBase):
    id: int
    quiz_id: int
    
    class Config:
        orm_mode = True # Cho phép Pydantic đọc từ object SQLAlchemy

# --- Schemas cho Quiz (Mới) ---
class QuizBase(BaseModel):
    title: Optional[str] = "Bộ quiz mới"

class QuizCreate(QuizBase):
    # Khi tạo quiz, chúng ta cũng tạo luôn các câu hỏi
    # questions sẽ là một danh sách các câu hỏi
    questions: List[QuestionCreate]

class QuizOut(QuizBase):
    id: int
    owner_id: int
    created_at: datetime # Giữ kiểu datetime
    questions: List[QuestionOut] = [] # Trả về danh sách các câu hỏi

    class Config:
        orm_mode = True

# --- Schemas cho User (Cập nhật) ---
class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel): # Schema mới cho /login
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    # quizzes: List[QuizOut] = [] # Có thể thêm dòng này nếu muốn trả về quiz của user

    class Config:
        orm_mode = True

# --- Schemas cho Token (JWT) (Mới) ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None