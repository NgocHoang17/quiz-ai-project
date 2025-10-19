from pydantic import BaseModel, Field # Import thêm Field
from typing import List, Optional
from datetime import datetime

# --- Schemas cho Question (Giữ nguyên) ---
class QuestionBase(BaseModel):
    question_text: str
    choice_a: str
    choice_b: str
    choice_c: str
    choice_d: str
    correct_answer: str

class QuestionCreate(QuestionBase):
    pass

class QuestionOut(QuestionBase):
    id: int
    quiz_id: int
    class Config:
        from_attributes = True # Đã sửa từ 'orm_mode'

# --- Schemas cho Quiz (Giữ nguyên) ---
class QuizBase(BaseModel):
    title: Optional[str] = "Bộ quiz mới"

class QuizCreate(QuizBase):
    questions: List[QuestionCreate]

class QuizOut(QuizBase):
    id: int
    owner_id: int
    created_at: datetime
    questions: List[QuestionOut] = []
    class Config:
        from_attributes = True # Đã sửa từ 'orm_mode'

# --- Schemas cho User (Cập nhật) ---
class UserCreate(BaseModel):
    email: str
    # === CẬP NHẬT: Thêm validation cho mật khẩu ===
    password: str = Field(..., min_length=6, max_length=72)
    # ==========================================

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    class Config:
        from_attributes = True # Đã sửa từ 'orm_mode'

# --- Schemas cho Token (JWT) (Giữ nguyên) ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None