# quiz-ai-project
// vào mt ảo
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\venv\Scripts\activate
// thoát mt ảo
deactivate

//
uvicorn backend.main:app --reload