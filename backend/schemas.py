from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# --- Schemas cho Folder (MỚI) ---
class FolderBase(BaseModel):
    name: str

class FolderCreate(FolderBase):
    pass

class FolderOut(FolderBase):
    id: int
    user_id: int
    created_at: datetime
    class Config:
        from_attributes = True

# --- Schemas cho Question ---
class QuestionBase(BaseModel):
    question_text: str
    choice_a: str
    choice_b: str
    choice_c: str
    choice_d: str
    correct_answer: str
    explanation: Optional[str] = None
    citation: Optional[str] = None

class QuestionCreate(QuestionBase):
    pass

class QuestionOut(QuestionBase):
    id: int
    quiz_id: int
    class Config:
        from_attributes = True

# --- Schemas cho Quiz (CẬP NHẬT) ---
class QuizBase(BaseModel):
    title: str
    folder_id: Optional[int] = None
    quiz_type: str = "mcq"
    
class QuizCreate(QuizBase):
    questions: List[QuestionCreate]

class QuizOut(QuizBase):
    id: int
    created_at: datetime
    owner_id: int
    is_favorite: bool = False #  Mới
    questions: List[QuestionOut] = [] 
    
    class Config:
        orm_mode = True

# --- Schema Kết quả làm bài ---
class QuizResultCreate(BaseModel):
    score: int
    total_questions: int

class QuizResultOut(BaseModel):
    id: int
    quiz_title: str # Sẽ map thủ công hoặc dùng hybrid property
    score: int
    total_questions: int
    completed_at: datetime
    class Config:
        orm_mode = True

# --- Schema cho việc di chuyển Quiz (MỚI) ---
class MoveQuizSchema(BaseModel):
    folder_id: Optional[int] = None # Int là ID folder, None là ra thư mục gốc

# --- Schemas cho User ---
class UserCreate(BaseModel):
    email: str
    password: str = Field(..., min_length=6, max_length=72)

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    class Config:
        from_attributes = True

# --- Schemas cho Token ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None