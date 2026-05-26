"""硅基流动 AI 简历解析"""
import json
import httpx
from datetime import datetime
from app.config import settings
from app.schemas import ResumeParseResponse, ResumeExtractedInfo

BASE_URL = "https://api.siliconflow.cn/v1"
TEXT_MODEL = "Qwen/Qwen3-8B"
VISION_MODEL = "Qwen/Qwen3-VL-8B-Instruct"

def _build_extraction_prompt() -> str:
    y = datetime.now().year
    return f"""你是一个专业的简历信息提取助手。请严格按以下 JSON 格式输出：
{{"name":null,"phone":null,"email":null,"gender":null,"birth_year":null,"school":null,"major":null,"education":null,"is_fresh_grad":null,"channel":null}}
提取规则：姓名取最可能的中文姓名(2-4字)；手机号1开头11位；学历取最高，只能从以下选项中选择：本科（全日制）、专转本（非全日制）、专转本（全日制）、硕士、专科（全日制）、专科（非全日制）；应届生判断：毕业时间为{y}届或{y+1}届的标记为"是"，其他情况标记为"否"，无法判断则为空"""


async def _call_llm(model: str, messages: list, temperature: float = 0.1) -> str:
    api_key = settings.SILICONFLOW_API_KEY
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": model, "messages": messages, "temperature": temperature},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


def _parse_json(text: str) -> ResumeExtractedInfo:
    text = text.strip().removeprefix("```json").removesuffix("```").strip()
    try:
        return ResumeExtractedInfo(**json.loads(text))
    except Exception:
        return ResumeExtractedInfo()


async def parse_resume_pdf(content: bytes, filename: str) -> ResumeParseResponse:
    # Use SiliconFlow vision model directly — simpler pipeline
    import base64
    b64 = base64.b64encode(content).decode()

    messages = [{
        "role": "system",
        "content": _build_extraction_prompt() + "\n输入是简历图片/扫描件，请先识别文字再提取信息。",
    }, {
        "role": "user",
        "content": [{"type": "text", "text": "请从以下简历中提取结构化信息"},
                    {"type": "image_url", "image_url": {"url": f"data:application/pdf;base64,{b64}"}}],
    }]

    result_text = await _call_llm(VISION_MODEL, messages)
    extracted = _parse_json(result_text)

    # Rule-engine fallback: infer is_fresh_grad from birth_year + education
    if extracted.is_fresh_grad is None:
        extracted.is_fresh_grad = _infer_fresh_grad(extracted.birth_year, extracted.education)

    return ResumeParseResponse(
        filename=filename,
        page_count=1,
        raw_text="[视觉模型识别]",
        parse_mode="image",
        extracted=extracted,
    )


def _infer_fresh_grad(birth_year, education: str | None) -> str | None:
    """Fallback: infer fresh grad status from birth year and education level."""
    if birth_year is None:
        return None
    try:
        by = int(birth_year)
    except (TypeError, ValueError):
        return None
    current_year = datetime.now().year
    # Rough grad year: bachelor ~22yo, master ~25yo
    grad_year = by + 26 if education and "硕士" in education else by + 23
    return "是" if grad_year >= current_year - 1 else "否"
