from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func # Để lấy thời gian mặc định
from .database import Base # Import Base từ file database.py

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # Tăng độ dài của String để tương thích với MySQL
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Mối quan hệ: Một User có thể có nhiều Quizzes
    quizzes = relationship("Quiz", back_populates="owner")

class Quiz(Base):
    __tablename__ = "quizzes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, default="Bộ quiz mới")
    # server_default=func.now() sẽ tự động thêm thời gian khi tạo
    created_at = Column(TIMESTAMP, server_default=func.now())
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Mối quan hệ: Một Quiz thuộc về một User
    owner = relationship("User", back_populates="quizzes")
    # Mối quan hệ: Một Quiz có nhiều Questions
    # cascade="all, delete-orphan": Nếu xóa Quiz, các Question liên quan sẽ tự động bị xóa
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text, nullable=False)
    choice_a = Column(String(255), nullable=False)
    choice_b = Column(String(255), nullable=False)
    choice_c = Column(String(255), nullable=False)
    choice_d = Column(String(255), nullable=False)
    correct_answer = Column(String(1), nullable=False) # 'A', 'B', 'C', 'D'
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)

    # Mối quan hệ: Một Question thuộc về một Quiz
    quiz = relationship("Quiz", back_populates="questions")


class UserQuestionStats(Base):
    __tablename__ = "user_question_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    
    # "Bộ nhớ" mà bạn muốn
    correct_attempts = Column(Integer, default=0)    # Số lần trả lời đúng
    incorrect_attempts = Column(Integer, default=0)  # Số lần trả lời sai
    
    last_attempted_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # Mối quan hệ (không bắt buộc nhưng nên có)
    user = relationship("User")
    question = relationship("Question")