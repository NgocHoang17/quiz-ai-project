from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

#  BẢNG USER 
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    # MySQL cần độ dài cụ thể cho String, đặc biệt là unique/index
    email = Column(String(255), unique=True, index=True) 
    hashed_password = Column(String(255))
    
    quizzes = relationship("Quiz", back_populates="owner")
    folders = relationship("Folder", back_populates="user")
    question_stats = relationship("UserQuestionStats", back_populates="user")
    quiz_results = relationship("QuizResult", back_populates="user")

#  BẢNG FOLDER 
class Folder(Base):
    __tablename__ = "folders"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255)) #  Thêm độ dài
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    user = relationship("User", back_populates="folders")
    quizzes = relationship("Quiz", back_populates="folder")

#  BẢNG QUIZ 
class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255)) #  Thêm độ dài
    created_at = Column(DateTime, default=datetime.utcnow)
    quiz_type = Column(String(50), default="mcq") #  Thêm độ dài
    
    is_favorite = Column(Boolean, default=False) 

    owner_id = Column(Integer, ForeignKey("users.id"))
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)

    owner = relationship("User", back_populates="quizzes")
    folder = relationship("Folder", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    results = relationship("QuizResult", back_populates="quiz")

#  BẢNG QUESTION 
class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text) # Text trong MySQL không cần độ dài
    
    #  Các lựa chọn nên có độ dài giới hạn hoặc dùng Text nếu quá dài
    choice_a = Column(String(255)) 
    choice_b = Column(String(255))
    choice_c = Column(String(255))
    choice_d = Column(String(255))
    correct_answer = Column(String(10)) # Ví dụ: "A", "B"...
    
    explanation = Column(Text, nullable=True)
    citation = Column(Text, nullable=True)
    
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    quiz = relationship("Quiz", back_populates="questions")

#  BẢNG THỐNG KÊ CÂU HỎI 
class UserQuestionStats(Base):
    __tablename__ = "user_question_stats"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    question_id = Column(Integer, ForeignKey("questions.id"))
    correct_attempts = Column(Integer, default=0)
    incorrect_attempts = Column(Integer, default=0)
    last_attempted_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="question_stats")
    question = relationship("Question")

#  BẢNG LỊCH SỬ LÀM BÀI 
class QuizResult(Base):
    __tablename__ = "quiz_results"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    quiz_id = Column(Integer, ForeignKey("quizzes.id"))
    score = Column(Integer) 
    total_questions = Column(Integer)
    completed_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="quiz_results")
    quiz = relationship("Quiz", back_populates="results")