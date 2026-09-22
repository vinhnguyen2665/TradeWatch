import asyncio
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

GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiAdvisorService:
    """
    Dịch vụ AI Cố vấn Phân bổ Vốn & Hoạch định Danh mục (Robo-Advisor)
    sử dụng Google Gemini Flash API với Structured JSON Output.
    """

    FALLBACK_MODELS = [
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
    ]

    def __init__(self, default_model: str = "gemini-3.5-flash", timeout_sec: float = 180.0):
        self.default_model = default_model
        self.timeout = timeout_sec
        self._cached_models: List[Dict[str, Any]] = []
        self._cache_time: float = 0.0

    async def list_available_models(self, api_key: str) -> List[Dict[str, Any]]:
        """
        Đồng bộ trực tiếp danh sách mô hình từ Google Generative Language API (không hardcode).
        Chỉ lọc các model phù hợp cho phân tích văn bản & tài chính (generateContent).
        """
        if not api_key or not api_key.strip() or api_key.strip().startswith("****"):
            return []

        clean_key = api_key.strip()
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={clean_key}"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    logger.warning(f"Failed to fetch models from Google: {resp.status_code} - {resp.text[:200]}")
                    return []

                data = resp.json()
                raw_models = data.get("models", [])
                result = []

                # Danh sách từ khóa loại trừ (các model âm thanh, hình ảnh, nhúng, chuyên biệt không dùng cho chat/analysis)
                excluded_keywords = [
                    "embedding", "tts", "image", "transcribe", "robotics",
                    "veo", "clip", "aqa", "lyria", "customtools"
                ]

                for m in raw_models:
                    methods = m.get("supportedGenerationMethods", [])
                    if "generateContent" not in methods:
                        continue

                    full_name = m.get("name", "")
                    model_id = full_name.replace("models/", "") if full_name.startswith("models/") else full_name

                    if any(kw in model_id.lower() for kw in excluded_keywords):
                        continue

                    display_name = m.get("displayName") or model_id
                    description = m.get("description", "")

                    is_recommended = (
                        "3.5-flash" in model_id
                        or "3.6-flash" in model_id
                        or "flash" in model_id.lower()
                    )

                    result.append({
                        "id": model_id,
                        "name": model_id,
                        "display_name": display_name,
                        "description": description,
                        "input_token_limit": m.get("inputTokenLimit"),
                        "output_token_limit": m.get("outputTokenLimit"),
                        "is_recommended": is_recommended,
                    })

                # Sắp xếp: Ưu tiên Flash models, sau đó xếp theo tên
                result.sort(key=lambda x: (not x["is_recommended"], x["name"]))
                return result
        except Exception as e:
            logger.error(f"Error fetching Google Gemini models: {e}")
            return []

    async def generate_allocation_strategy(
        self,
        api_key: str,
        total_capital: float,
        vn30_tickers: List[str],
        midcap_tickers: List[str],
        penny_tickers: List[str],
        ticker_details: Dict[str, Dict[str, Any]],
        risk_profile: str = "BALANCED",
        custom_weights: Optional[Dict[str, float]] = None,
        model_name: Optional[str] = None,
    ) -> PortfolioAllocationResult:
        """
        Gọi Google Gemini API để phân tích và lập kế hoạch phân bổ vốn chi tiết cho danh sách cổ phiếu nhiều nhóm.
        """
        if not api_key or not api_key.strip():
            raise ValueError("Google Gemini API Key không được để trống. Vui lòng cấu hình trong Cài đặt hoặc nhập trực tiếp.")

        # Lọc danh sách ticker hợp lệ
        v_list = [t.strip().upper() for t in vn30_tickers if t and t.strip()]
        m_list = [t.strip().upper() for t in midcap_tickers if t and t.strip()]
        p_list = [t.strip().upper() for t in penny_tickers if t and t.strip()]

        if not v_list and not m_list and not p_list:
            raise ValueError("Vui lòng chọn ít nhất 1 mã cổ phiếu để lập kế hoạch phân bổ vốn.")

        model = model_name or self.default_model
        clean_key = api_key.strip()

        # Tính toán tỷ trọng phân bổ từng nhóm (chỉ phân bổ cho các nhóm có mã cổ phiếu được chọn)
        weights = custom_weights or {"vn30": 60.0, "midcap": 30.0, "penny": 10.0}
        raw_vn30 = float(weights.get("vn30", 60.0)) if v_list else 0.0
        raw_midcap = float(weights.get("midcap", 30.0)) if m_list else 0.0
        raw_penny = float(weights.get("penny", 10.0)) if p_list else 0.0

        raw_total = raw_vn30 + raw_midcap + raw_penny
        if raw_total > 0:
            w_vn30_group = round((raw_vn30 / raw_total) * 100.0, 1) if v_list else 0.0
            w_midcap_group = round((raw_midcap / raw_total) * 100.0, 1) if m_list else 0.0
            w_penny_group = round(100.0 - w_vn30_group - w_midcap_group, 1) if p_list else 0.0
        else:
            w_vn30_group = 0.0
            w_midcap_group = 0.0
            w_penny_group = 0.0

        cap_vn30_group = total_capital * (w_vn30_group / 100.0)
        cap_midcap_group = total_capital * (w_midcap_group / 100.0)
        cap_penny_group = total_capital * (w_penny_group / 100.0)

        # Xây dựng danh sách text chi tiết cho prompt
        def _build_group_prompt(group_name: str, group_pct: float, group_cap: float, tickers: List[str]) -> str:
            if not tickers:
                return f"  - Nhóm {group_name}: Không chọn mã nào trong đợt này (0% vốn)."
            count = len(tickers)
            sub_pct = round(group_pct / count, 1) if count > 0 else group_pct
            sub_cap = group_cap / count if count > 0 else group_cap
            lines = [f"  - Nhóm {group_name} ({group_pct}% vốn = {group_cap:,.0f} VND, chia {count} mã):"]
            for t in tickers:
                detail = ticker_details.get(t, {})
                p_k = float(detail.get("price", 25.0))
                p_vnd = p_k * 1000.0
                name = detail.get("name", f"Công ty Cổ phần {t}")
                shares = max(100, int((sub_cap / p_vnd) // 100) * 100) if p_vnd > 0 else 100
                lines.append(
                    f"    + Mã {t} ({name}): Tỷ trọng ~{sub_pct}% ({sub_cap:,.0f} VND), Giá hiện tại {p_k:.2f} ({p_vnd:,.0f} đ/CP), Ước tính mua ~{shares:,} CP"
                )
            return "\n".join(lines)

        prompt_vn30_sec = _build_group_prompt("Trụ cột / VN30", w_vn30_group, cap_vn30_group, v_list)
        prompt_midcap_sec = _build_group_prompt("Đón sóng chu kỳ / Midcap", w_midcap_group, cap_midcap_group, m_list)
        prompt_penny_sec = _build_group_prompt("Lướt sóng / Penny", w_penny_group, cap_penny_group, p_list)

        all_tickers = v_list + m_list + p_list

        system_instruction = (
            "Bạn là Chuyên gia Cố vấn Đầu tư Cấp cao (Chief Investment Officer & Robo-Advisor Architect) "
            "hàng đầu tại Thị trường Chứng khoán Việt Nam (HOSE, HNX, UPCoM), có hơn 15 năm kinh nghiệm phân tích cơ bản (FA), "
            "phân tích kỹ thuật (TA), quản trị rủi ro danh mục (Portfolio Risk Management) và thấu hiểu tâm lý giao dịch.\n"
            "Nhiệm vụ của bạn là đưa ra một bản khuyến nghị chiến lược phân bổ vốn danh mục hoàn chỉnh, chuyên sâu, thực chiến và khả thi cao "
            "cho toàn bộ danh sách các mã cổ phiếu được cung cấp trong từng nhóm.\n"
            "BẮT BUỘC trả về định dạng JSON thuần túy theo đúng JSON Schema được yêu cầu."
        )

        prompt_text = f"""
Hãy lập kế hoạch phân bổ vốn và hoạch định chiến lược đầu tư chi tiết cho danh mục sau:

THÔNG TIN DANH MỤC ĐẦU VÀO:
- Tổng vốn đầu tư: {total_capital:,.0f} VND
- Khẩu vị rủi ro: {risk_profile}
- Danh sách cổ phiếu được lựa chọn theo 3 nhóm:
{prompt_vn30_sec}
{prompt_midcap_sec}
{prompt_penny_sec}

YÊU CẦU ĐẦU RA JSON STRUCTURED OUTPUT:
Hãy trả về JSON với cấu trúc chính xác sau (Bắt buộc phân bổ đầy đủ cho TẤT CẢ các mã {', '.join(all_tickers)}):
{{
  "total_capital": {total_capital},
  "risk_profile": "{risk_profile}",
  "executive_summary": "Tóm tắt chiến lược tổng thể về việc phân bổ tỷ trọng {w_vn30_group}% VN30 / {w_midcap_group}% Midcap / {w_penny_group}% Penny cho danh sách {len(all_tickers)} mã cổ phiếu, nguyên tắc cân bằng giữa an toàn tăng trưởng và tối ưu hóa lợi suất",
  "market_cycle_assessment": "Đánh giá bối cảnh thị trường VN-Index hiện tại, chu kỳ dòng tiền luân chuyển giữa các nhóm ngành được chọn",
  "estimated_portfolio_yield": "Kỳ vọng tỷ suất sinh lời ròng của toàn danh mục trong chu kỳ 6-12 tháng (VD: 18% - 28%/năm)",
  "summary_table": [
    // Mỗi mã cổ phiếu trong danh sách ({', '.join(all_tickers)}) là 1 object trong mảng:
    // {{
    //   "asset_class": "VN30 / Bluechip" hoặc "Midcap / HNX30" hoặc "Penny / Smallcap",
    //   "ticker": "MÃ_CP",
    //   "company_name": "Tên công ty",
    //   "capital_percentage": số_phần_trăm_vốn_cho_mã_này,
    //   "allocated_amount": số_tiền_VND,
    //   "current_price": giá_VND,
    //   "estimated_shares": số_lô_CP_làm_tròn_100,
    //   "strategic_position": "Vị thế chiến lược",
    //   "profit_target": "Mục tiêu chốt lời (% và vùng giá)",
    //   "stop_loss": "Ngưỡng cắt lỗ"
    // }}
  ],
  "detailed_strategies": [
    // Mỗi mã cổ phiếu ({', '.join(all_tickers)}) có 1 object chiến lược chi tiết:
    // {{
    //   "ticker": "MÃ_CP",
    //   "asset_class": "Nhóm tài sản",
    //   "percentage": số_phần_trăm_vốn,
    //   "title": "Tiêu đề chiến lược vị thế",
    //   "badge_type": "SAFE" hoặc "MEDIUM" hoặc "HIGH_RISK",
    //   "position_analysis": "Phân tích kỹ thuật & cơ bản chi tiết",
    //   "execution_strategy": "Chiến lược giải ngân gom hàng (DCA, mua nhịp pullback, v.v.)",
    //   "buy_zone": "Vùng giá mua gom tối ưu",
    //   "profit_target_zone": "Vùng kháng cự chốt lời",
    //   "stop_loss_zone": "Mức cắt lỗ vi phạm",
    //   "risk_notes": "Lưu ý quản trị rủi ro"
    // }}
  ],
  "risk_management_rules": [
    "Kỷ luật tỷ trọng: Tuyệt đối không dồn quá mức cho phép vào nhóm đầu cơ.",
    "Nguyên tắc cắt lỗ tự động khi vi phạm ngưỡng cảnh báo.",
    "Tái cân bằng danh mục khi tỷ trọng biến động lệch quá 10%."
  ]
}}
"""

        candidate_models = [model]
        for fb in self.FALLBACK_MODELS:
            if fb not in candidate_models:
                candidate_models.append(fb)

        request_payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt_text}],
                }
            ],
            "systemInstruction": {
                "parts": [{"text": system_instruction}]
            },
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
                "topP": 0.95,
            },
        }

        last_err_msg = ""
        client_timeout = httpx.Timeout(self.timeout, connect=20.0)
        async with httpx.AsyncClient(timeout=client_timeout) as client:
            for current_m in candidate_models:
                url = f"{GEMINI_API_BASE_URL}/{current_m}:generateContent?key={clean_key}"
                try:
                    resp = await client.post(url, json=request_payload)

                    if resp.status_code in (404, 503):
                        logger.warning(f"Model {current_m} returned {resp.status_code}, trying next fallback model...")
                        last_err_msg = f"Model {current_m} (HTTP {resp.status_code})"
                        await asyncio.sleep(0.5)
                        continue

                    if resp.status_code == 400:
                        err_json = resp.json().get("error", {})
                        msg = err_json.get("message", "API Key không hợp lệ hoặc tham số yêu cầu sai")
                        logger.error(f"Gemini API 400 Error: {msg}")
                        raise ValueError(f"Lỗi cấu hình Google AI Studio: {msg}")

                    if resp.status_code in (401, 403):
                        logger.error(f"Gemini API Auth Error: {resp.text}")
                        raise ValueError("Google Gemini API Key không hợp lệ hoặc không có quyền truy cập. Vui lòng kiểm tra lại API Key.")

                    if resp.status_code == 429:
                        logger.warning(f"Model {current_m} rate limited (429), trying next fallback model...")
                        last_err_msg = f"Model {current_m} quá tải (429)"
                        await asyncio.sleep(1.0)
                        continue

                    if resp.status_code != 200:
                        logger.error(f"Gemini API returned status {resp.status_code}: {resp.text}")
                        raise ValueError(f"Lỗi khi kết nối Google Gemini API (Mã lỗi {resp.status_code}): {resp.text[:200]}")

                    resp_data = resp.json()

                    # Trích xuất nội dung trả về
                    candidates = resp_data.get("candidates", [])
                    if not candidates:
                        raise ValueError("Gemini API không trả về nội dung phản hồi hợp lệ.")

                    parts = candidates[0].get("content", {}).get("parts", [])
                    if not parts:
                        raise ValueError("Nội dung phản hồi từ Gemini API bị rỗng.")

                    raw_text = parts[0].get("text", "").strip()

                    # Clean markdown code block if present
                    clean_json_str = self._extract_json_string(raw_text)
                    parsed_dict = json.loads(clean_json_str)

                    # Validate & parse through Pydantic
                    allocation_result = PortfolioAllocationResult(**parsed_dict)
                    
                    # Chuẩn hóa số học 100% chính xác (khử sai số / hallucination của AI)
                    allocation_result = self._normalize_allocation_result(
                        allocation_result=allocation_result,
                        total_capital=total_capital,
                        ticker_details=ticker_details,
                    )
                    return allocation_result

                except httpx.TimeoutException:
                    logger.warning(f"Gemini API call timed out for model {current_m}, trying next fallback model...")
                    last_err_msg = f"Model {current_m} bị timeout (quá thời gian chờ)"
                    continue
                except json.JSONDecodeError as jde:
                    logger.warning(f"Failed to decode JSON from Gemini model {current_m}: {jde}, trying next fallback model...")
                    last_err_msg = f"Model {current_m} trả về phản hồi không phải JSON hợp lệ"
                    continue
                except Exception as e:
                    if isinstance(e, ValueError) and "Google Gemini API Key" in str(e):
                        raise e
                    logger.warning(f"Error calling model {current_m}: {e}, trying next fallback model...")
                    last_err_msg = f"Model {current_m} gặp lỗi: {str(e)}"
                    continue

        raise ValueError(f"Không thể hoàn thành phân bổ vốn: Tất cả các model Google AI đều đang quá tải hoặc tạm thời không khả dụng. Chi tiết: {last_err_msg}. Vui lòng thử lại sau giây lát.")


    def _normalize_allocation_result(
        self,
        allocation_result: PortfolioAllocationResult,
        total_capital: float,
        ticker_details: Dict[str, Dict[str, Any]],
    ) -> PortfolioAllocationResult:
        """
        Khử bỏ hoàn toàn sai số / hallucination của AI về số học tài chính:
        Tự động tính toán lại 100% chính xác bằng toán học:
        - allocated_amount = round(total_capital * (capital_percentage / 100.0))
        - current_price = lấy giá thực từ sàn (x1000 VND) nếu có
        - estimated_shares = làm tròn lô 100 CP theo quy chuẩn sàn HOSE/HNX
        """
        if not allocation_result or not allocation_result.summary_table:
            return allocation_result

        for item in allocation_result.summary_table:
            t = item.ticker.upper()
            detail = ticker_details.get(t, {})
            real_price_k = float(detail.get("price", 0.0))
            if real_price_k > 0:
                item.current_price = real_price_k * 1000.0
            elif item.current_price < 1000:
                item.current_price = item.current_price * 1000.0

            # Tính toán chính xác số tiền phân bổ theo tỷ trọng và tổng vốn (không để AI tự suy diễn sai số 0)
            item.allocated_amount = round(total_capital * (item.capital_percentage / 100.0))

            # Tính toán lại khối lượng mua làm tròn chuẩn lô 100
            if item.current_price > 0:
                item.estimated_shares = max(100, int((item.allocated_amount / item.current_price) // 100) * 100)

        # Cập nhật lại tỷ trọng trong detailed_strategies cho đồng bộ
        pct_map = {item.ticker.upper(): item.capital_percentage for item in allocation_result.summary_table}
        for strat in allocation_result.detailed_strategies:
            t = strat.ticker.upper()
            if t in pct_map:
                strat.percentage = pct_map[t]

        return allocation_result


    def _extract_json_string(self, text: str) -> str:
        """Trích xuất chuỗi JSON hợp lệ từ text phản hồi kể cả khi có bọc markdown."""
        text = text.strip()
        # Tìm khối ```json ... ```
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            return match.group(1).strip()
        return text


gemini_advisor_service = GeminiAdvisorService()
