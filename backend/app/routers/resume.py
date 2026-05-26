"""AI 简历解析 — 硅基流动"""
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.dependencies import get_current_user
from app.schemas import ResumeParseResponse, ResumeExtractedInfo
from app.services.ai_service import parse_resume_pdf

router = APIRouter()


@router.post("/resume/parse", response_model=ResumeParseResponse, tags=["简历解析"])
async def parse_resume(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="仅支持 PDF 格式")
    if file.size and file.size > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件不能超过 20MB")

    content = await file.read()
    result = await parse_resume_pdf(content, file.filename)
    return result
