import json
import logging
import re
from typing import Dict, Any, Optional, List
import httpx

from app.schemas import (
    PortfolioAllocationResult,
    AssetAllocationItem,
    DetailedPositionStrategy,
)

logger = logging.getLogger(__name__)


class OpenAIAdvisorService:
    """
    Dịch vụ AI Cố vấn Phân bổ Vốn & Hoạch định Danh mục
    hỗ trợ OpenAI (ChatGPT) và Local AI (Ollama, LM Studio) qua chuẩn OpenAI REST API.
    Toàn bộ danh sách model được đồng bộ trực tiếp từ Provider API (không hardcode).
    """

    def __init__(self, timeout_sec: float = 180.0):
        self.timeout = timeout_sec

    async def list_available_models(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.openai.com/v1",
    ) -> List[Dict[str, Any]]:
        """
        Đồng bộ trực tiếp danh sách mô hình từ OpenAI API hoặc Local AI (Ollama/LM Studio).
        KHÔNG sử dụng danh sách hardcode.
        """
        clean_base = base_url.strip().rstrip("/")
        is_openai_official = "api.openai.com" in clean_base

        # 1. Với OpenAI chính thức: Yêu cầu có API Key thực tế để lấy danh sách model
        if is_openai_official:
            if not api_key or not api_key.strip() or api_key.strip().startswith("****"):
                return []

            headers = {
                "Authorization": f"Bearer {api_key.strip()}",
                "Content-Type": "application/json",
            }
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.get("https://api.openai.com/v1/models", headers=headers)
                    if resp.status_code != 200:
                        logger.warning(f"Failed to fetch models from OpenAI: {resp.status_code} - {resp.text[:200]}")
                        return []

                    data = resp.json()
                    items = data.get("data", [])
                    result = []

                    excluded_keywords = [
                        "realtime", "audio", "whisper", "tts", "dall-e", "embedding",
                        "moderation", "babbage", "davinci", "search", "transcribe",
                        "instruct", "similarity", "edit"
                    ]

                    for m in items:
                        m_id = m.get("id", "")
                        if not m_id:
                            continue
                        low = m_id.lower()

                        # Chỉ lọc các model phù hợp cho tác vụ chat / suy luận / phân tích tài chính
                        if not any(k in low for k in ["gpt-4", "gpt-3.5", "o1", "o3", "chatgpt"]):
                            continue
                        if any(k in low for k in excluded_keywords):
                            continue

                        is_rec = m_id in ("gpt-4o-mini", "gpt-4o", "o3-mini")

                        # Định dạng tên hiển thị thân thiện
                        if m_id == "gpt-4o-mini":
                            display_name = "GPT-4o Mini (Khuyên dùng - Nhanh & Tối ưu chi phí)"
                        elif m_id == "gpt-4o":
                            display_name = "GPT-4o (Toàn diện & Thông minh cao nhất)"
                        elif m_id == "o3-mini":
                            display_name = "o3-mini (Suy luận chuyên sâu)"
                        elif m_id == "o1":
                            display_name = "o1 (Reasoning Flagship)"
                        elif m_id == "o1-mini":
                            display_name = "o1-mini (Reasoning Tốc độ cao)"
                        elif m_id.startswith("gpt-4"):
                            display_name = f"OpenAI {m_id}"
                        else:
                            display_name = m_id

                        result.append({
                            "id": m_id,
                            "name": m_id,
                            "display_name": display_name,
                            "description": f"Mô hình chính thức tải từ OpenAI API ({m_id})",
                            "is_recommended": is_rec,
                        })

                    result.sort(key=lambda x: (not x["is_recommended"], x["id"]))
                    return result
            except Exception as e:
                logger.warning(f"Error connecting to OpenAI models endpoint: {e}")
                return []

        # 2. Với Local AI (Ollama / LM Studio / vLLM / LocalAI)
        headers = {}
        if api_key and api_key.strip() and not api_key.strip().startswith("****"):
            headers["Authorization"] = f"Bearer {api_key.strip()}"

        items = []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Thử chuẩn OpenAI: GET {clean_base}/models
                url = f"{clean_base}/models"
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get("data", []) or data.get("models", [])
                elif resp.status_code in (404, 405):
                    # Nếu chạy Ollama server native port, thử endpoint /api/tags
                    alt_url = clean_base[:-3] + "/api/tags" if clean_base.endswith("/v1") else f"{clean_base}/api/tags"
                    resp2 = await client.get(alt_url, headers=headers)
                    if resp2.status_code == 200:
                        items = resp2.json().get("models", [])
        except Exception as e:
            # Thử lại endpoint Ollama native nếu /v1/models không phản hồi
            try:
                alt_url = clean_base[:-3] + "/api/tags" if clean_base.endswith("/v1") else f"{clean_base}/api/tags"
                async with httpx.AsyncClient(timeout=5.0) as client2:
                    resp2 = await client2.get(alt_url, headers=headers)
                    if resp2.status_code == 200:
                        items = resp2.json().get("models", [])
            except Exception:
                logger.debug(f"Could not connect to Local AI at {clean_base}: {e}")
                return []

        result = []
        for idx, m in enumerate(items):
            m_id = m.get("id") or m.get("name") or m.get("model") or ""
            if not m_id:
                continue
            result.append({
                "id": m_id,
                "name": m_id,
                "display_name": f"{m_id} (Local)",
                "description": f"Mô hình tải trực tiếp từ máy chủ Local AI ({clean_base})",
                "is_recommended": (idx == 0),
            })

        return result

    async def generate_allocation_strategy(
        self,
        api_key: Optional[str],
        total_capital: float,
        vn30_tickers: List[str],
        midcap_tickers: List[str],
        penny_tickers: List[str],
        ticker_details: Dict[str, Dict[str, Any]],
        risk_profile: str = "BALANCED",
        custom_weights: Optional[Dict[str, float]] = None,
        model_name: Optional[str] = None,
        base_url: str = "https://api.openai.com/v1",
    ) -> PortfolioAllocationResult:
        """
        Gọi OpenAI hoặc Local AI (Ollama/LM Studio) để sinh chiến lược phân bổ danh mục.
        """
        clean_base = base_url.strip().rstrip("/")
        is_openai_official = "api.openai.com" in clean_base

        if is_openai_official and (not api_key or not api_key.strip()):
            raise ValueError("Vui lòng nhập OpenAI API Key để sử dụng mô hình ChatGPT.")

        active_model = model_name or ("gpt-4o-mini" if is_openai_official else "llama3.1:latest")

        # 1. Chuẩn bị weights
        weights = custom_weights or {
            "BALANCED": {"vn30": 60.0, "midcap": 30.0, "penny": 10.0},
            "DEFENSIVE": {"vn30": 70.0, "midcap": 20.0, "penny": 10.0},
            "GROWTH": {"vn30": 50.0, "midcap": 35.0, "penny": 15.0},
            "AGGRESSIVE": {"vn30": 40.0, "midcap": 40.0, "penny": 20.0},
        }.get(risk_profile, {"vn30": 60.0, "midcap": 30.0, "penny": 10.0})

        vn30_w = weights.get("vn30", 60.0)
        midcap_w = weights.get("midcap", 30.0)
        penny_w = weights.get("penny", 10.0)

        # 2. Định dạng thông tin thị giá
        ticker_info_lines = []
        for t, details in ticker_details.items():
            name = details.get("name", t)
            price_k = details.get("price", 25.0)
            price_vnd = price_k * 1000.0 if price_k < 1000 else price_k
            change = details.get("change_pct", 0.0)
            ticker_info_lines.append(
                f"- {t} ({name}): Thị giá hiện tại {price_vnd:,.0f} VND ({change:+.2f}%)"
            )
        ticker_info_text = "\n".join(ticker_info_lines)

        system_prompt = (
            "Bạn là Giám đốc Đầu tư Cấp cao (Chief Investment Officer) kiêm Kiến trúc sư Hệ thống Robo-Advisor hàng đầu "
            "về Thị trường Chứng khoán Việt Nam (HOSE/HNX/UPCoM). "
            "Nhiệm vụ của bạn là lập kế hoạch phân bổ vốn và chiến lược giao dịch chuẩn xác, thực chiến và khả thi cao nhất. "
            "BẮT BUỘC: Bạn chỉ trả về ĐÚNG 1 JSON OBJECT hợp lệ duy nhất, KHÔNG kèm lời dẫn, không markdown ngoài JSON."
        )

        user_content = f"""
Hãy hoạch định chiến lược phân bổ danh mục đầu tư chứng khoán Việt Nam:
- Tổng số vốn đầu tư: {total_capital:,.0f} VND
- Khẩu vị rủi ro: {risk_profile}
- Tỷ trọng phân bổ mục tiêu:
  + Nhóm VN30 / Bluechip ({', '.join(vn30_tickers)}): Tổng {vn30_w}% vốn
  + Nhóm Midcap / HNX30 ({', '.join(midcap_tickers)}): Tổng {midcap_w}% vốn
  + Nhóm Penny / Smallcap ({', '.join(penny_tickers)}): Tổng {penny_w}% vốn

Dữ liệu thị giá tham khảo:
{ticker_info_text}

QUY TẮC BẮT BUỘC VỀ SỐ HỌC:
1. Quy chuẩn lô giao dịch: Số lượng cổ phiếu 'estimated_shares' BẮT BUỘC là bội số của 100 (tối thiểu 100 CP).
2. Công thức: allocated_amount = round(total_capital * (capital_percentage / 100)).
3. estimated_shares = max(100, int((allocated_amount / current_price) // 100) * 100).
4. Tổng capital_percentage của tất cả các mã phải đúng bằng 100%.

Yêu cầu trả về đúng cấu trúc JSON sau:
{{
  "total_capital": {total_capital},
  "risk_profile": "{risk_profile}",
  "summary_table": [
    {{
      "asset_class": "VN30 / Bluechip hoặc Midcap / HNX30 hoặc Penny / Smallcap",
      "ticker": "Mã CP",
      "company_name": "Tên công ty",
      "capital_percentage": 20.0,
      "allocated_amount": 50000000.0,
      "current_price": 25000.0,
      "estimated_shares": 2000,
      "strategic_position": "Vai trò vị thế",
      "profit_target": "+15.0% - 20.0%",
      "stop_loss": "-6.0%"
    }}
  ],
  "detailed_strategies": [
    {{
      "ticker": "Mã CP",
      "asset_class": "Nhóm",
      "percentage": 20.0,
      "title": "Tiêu đề chiến lược",
      "badge_type": "SAFE hoặc MEDIUM hoặc HIGH_RISK",
      "position_analysis": "Phân tích vị thế ngắn gọn",
      "execution_strategy": "Kế hoạch giải ngân cụ thể theo từng đợt",
      "buy_zone": "20.50 - 21.20",
      "profit_target_zone": "24.50 - 26.00",
      "stop_loss_zone": "< 19.50",
      "risk_notes": "Lưu ý rủi ro"
    }}
  ],
  "executive_summary": "Tóm tắt chiến lược vĩ mô và phân bổ vốn",
  "market_cycle_assessment": "Đánh giá xu hướng và chu kỳ thị trường",
  "risk_management_rules": [
    "Quy tắc quản trị rủi ro 1",
    "Quy tắc quản trị rủi ro 2",
    "Quy tắc quản trị rủi ro 3"
  ],
  "estimated_portfolio_yield": "+18.0% - 25.0%/năm"
}}
"""

        headers = {"Content-Type": "application/json"}
        if api_key and api_key.strip():
            headers["Authorization"] = f"Bearer {api_key.strip()}"

        payload = {
            "model": active_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.4,
        }

        # Nếu là OpenAI hoặc model hỗ trợ json_object
        if is_openai_official:
            payload["response_format"] = {"type": "json_object"}

        timeout_obj = httpx.Timeout(self.timeout, connect=25.0)

        async with httpx.AsyncClient(timeout=timeout_obj) as client:
            url = f"{clean_base}/chat/completions"
            logger.info(f"Calling OpenAI/Local AI at {url} with model {active_model}...")
            resp = await client.post(url, headers=headers, json=payload)

            if resp.status_code != 200:
                err_text = resp.text[:400]
                logger.error(f"OpenAI/Local AI error: HTTP {resp.status_code} - {err_text}")
                if resp.status_code == 401:
                    raise ValueError("API Key không hợp lệ hoặc đã hết hạn.")
                elif resp.status_code == 429:
                    raise ValueError("Tài khoản đã vượt quá hạn mức truy vấn (Rate Limit / Quota Exceeded).")
                elif resp.status_code == 404:
                    raise ValueError(f"Không tìm thấy mô hình '{active_model}' tại endpoint {clean_base}.")
                raise ValueError(f"Lỗi từ AI Provider (HTTP {resp.status_code}): {err_text}")

            res_json = resp.json()
            choices = res_json.get("choices", [])
            if not choices:
                raise ValueError("AI không trả về kết quả nội dung.")

            raw_content = choices[0].get("message", {}).get("content", "")
            return self._parse_json_result(raw_content, total_capital, risk_profile)

    def _parse_json_result(
        self,
        raw_text: str,
        total_capital: float,
        risk_profile: str,
    ) -> PortfolioAllocationResult:
        clean = raw_text.strip()
        if clean.startswith("```"):
            clean = re.sub(r"^```(?:json)?\s*", "", clean, flags=re.MULTILINE)
            clean = re.sub(r"\s*```$", "", clean, flags=re.MULTILINE)

        data = json.loads(clean.strip())
        data["total_capital"] = total_capital
        data["risk_profile"] = risk_profile

        # Chuẩn hóa dữ liệu toán học
        data = self._normalize_allocation_result(data, total_capital)
        return PortfolioAllocationResult(**data)

    def _normalize_allocation_result(self, data: Dict[str, Any], total_capital: float) -> Dict[str, Any]:
        """Đảm bảo số học chính xác 100% và chuẩn lô 100 CP."""
        if not data or "summary_table" not in data:
            return data

        for item in data.get("summary_table", []):
            pct = float(item.get("capital_percentage", 0.0))
            correct_amount = round(total_capital * (pct / 100.0))
            item["allocated_amount"] = correct_amount

            price = float(item.get("current_price", 0.0))
            if price > 0:
                price_vnd = price * 1000.0 if price < 1000.0 else price
                item["current_price"] = price_vnd
                exact_shares = max(100, int((correct_amount / price_vnd) // 100) * 100)
                item["estimated_shares"] = exact_shares

        return data


openai_advisor_service = OpenAIAdvisorService()
