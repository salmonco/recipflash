from fastapi import FastAPI, UploadFile, File, HTTPException
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel, Field
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
import io
import json
import re
import asyncio
import time
from typing import List
from langchain_core.runnables import RunnableLambda, Runnable
from dotenv import load_dotenv
import pillow_heif

load_dotenv()

pillow_heif.register_heif_opener() # image/heic 파일도 읽을 수 있도록 등록

# tesseract 경로 지정 for ec2
# TODO: 로컬 서버에서 주석 처리 필요
# pytesseract.pytesseract.tesseract_cmd = "/usr/bin/tesseract"  # which tesseract 출력값

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Recipflash AI Server",
    description="AI server for recipe-related tasks using LangChain, including PDF and image processing.",
)

# --- LLM Setup ---
# Comment out the Ollama model to switch to OpenAI
# llm = ChatOllama(model="llama3")

# Uncomment the following line to use OpenAI
# temperature=0.0: 일관된 결과 생성 (같은 입력 → 같은 출력)
# seed: 완전한 재현성 보장 (동일 입력 → 동일 출력)
# response_format: JSON 형식 강제 (파싱 오류 방지)

# 메뉴 파싱용 LLM (JSON mode)
llm = ChatOpenAI(
    model="gpt-3.5-turbo-1106",  # JSON mode 지원 모델
    temperature=0.0,
    model_kwargs={
        "seed": 42,
        "response_format": {"type": "json_object"}  # JSON 응답 강제
    }
)

# 번역용 LLM (JSON mode 없음)
llm_translate = ChatOpenAI(
    model="gpt-3.5-turbo",
    temperature=0.0,
    model_kwargs={"seed": 42}
)

# --- API Models ---
class Menu(BaseModel):
    name: str = Field(description="메뉴 이름")
    ingredients: str = Field(description="메뉴 재료")

class MenuResponse(BaseModel):
    menus: list[Menu]

def parse_llm_response_to_menus(llm_output: str) -> List[Menu]:
    menus_list = []

    # Common alternative field names mapping
    field_renames = {
        "question": "name",
        "answer": "ingredients",
        "q": "name",
        "a": "ingredients",
        "front": "name",
        "back": "ingredients",
        "description": "ingredients",
        "title": "name",
        "content": "ingredients",
        "recipe": "name",
        "item": "name",
        "details": "ingredients",
        "term": "name",
        "definition": "ingredients",
        "prompt": "name",
        "response": "ingredients",
    }

    # Strategy 1: Look for JSON array directly, potentially within markdown code blocks
    json_patterns = [
        r'```json\s*(\[.*?\])\s*```',  # JSON array in markdown code block
        r'\[\s*\{.*\}\s*\]',           # Direct JSON array
    ]

    for pattern in json_patterns:
        match = re.search(pattern, llm_output, re.DOTALL)
        if match:
            json_str = match.group(1) if len(match.groups()) > 0 else match.group(0)
            try:
                data = json.loads(json_str)
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict):
                            processed_item = {}
                            for key, value in item.items():
                                new_key = field_renames.get(key.lower(), key)
                                processed_item[new_key] = value

                            if "name" in processed_item:
                                processed_item["ingredients"] = str(processed_item.get("ingredients", ""))
                                menus_list.append(Menu(
                                    name=str(processed_item["name"]),
                                    ingredients=processed_item["ingredients"]
                                ))
                    return menus_list # Return the list, even if it's empty
            except json.JSONDecodeError:
                # Continue to next pattern if parsing fails
                pass

    # Strategy 2: If no clear JSON array found, try to extract individual menu-like objects
    # This is a more lenient approach if the LLM is not strictly outputting an array
    # This might be useful if the LLM outputs something like:
    # {"name": "...", "ingredients": "..."}
    # {"name": "...", "ingredients": "..."}
    # (multiple objects without an enclosing array)
    
    # Regex to find individual JSON objects
    object_matches = re.findall(r'{\s*"name":\s*".*?",\s*"ingredients":\s*".*?"\s*}', llm_output, re.DOTALL)
    for obj_str in object_matches:
        try:
            item = json.loads(obj_str)
            if isinstance(item, dict):
                processed_item = {}
                for key, value in item.items():
                    new_key = field_renames.get(key.lower(), key)
                    processed_item[new_key] = value

                if "name" in processed_item:
                    processed_item["ingredients"] = str(processed_item.get("ingredients", ""))
                    menus_list.append(Menu(
                        name=str(processed_item["name"]),
                        ingredients=processed_item["ingredients"]
                    ))
        except json.JSONDecodeError:
            pass

    if menus_list:
        return menus_list

    # Strategy 3: Fallback - try to parse the entire output as JSON
    try:
        data = json.loads(llm_output.strip())

        # If data is an object with "menus" key (JSON mode response)
        if isinstance(data, dict) and "menus" in data:
            data = data["menus"]

        # Process the array
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    processed_item = {}
                    for key, value in item.items():
                        new_key = field_renames.get(key.lower(), key)
                        processed_item[new_key] = value

                    if "name" in processed_item:
                        processed_item["ingredients"] = str(processed_item.get("ingredients", ""))
                        menus_list.append(Menu(
                            name=str(processed_item["name"]),
                            ingredients=processed_item["ingredients"]
                        ))
            return menus_list # Return the list, even if it's empty
    except json.JSONDecodeError:
        pass

    raise ValueError(f"Failed to extract and parse any valid menus from LLM output. Raw output: {llm_output}")

# --- Language Translation Helper ---
# In a real-world scenario, you might use a dedicated translation API
# or a more sophisticated language detection and translation mechanism.
# For this example, we'll use a simple LLM call for translation.
async def translate_to_korean_llm(text: str) -> str:
    translation_prompt = PromptTemplate.from_template(
        "Translate the following text into Korean. Respond ONLY with the translated text, no extra words or explanations:\n{text}"
    )
    # Use translation LLM (without JSON mode)
    chain = translation_prompt | llm_translate | (lambda x: x.content)
    translated_text = await chain.ainvoke({"text": text})
    return translated_text.strip()

# ===== 변경 전 코드 (순차 번역) =====
# 성능 비교를 위해 아래 주석을 해제하고 "변경 후 코드" 부분을 주석 처리하면
# 변경 전 순차 처리 방식으로 실행됩니다.
#
# async def translate_menus_to_korean(menus: List[Menu]) -> List[Menu]:
#     translated_menus = []
#     for menu in menus:
#         is_korean_menu = any('\uac00' <= char <= '\ud7a3' for char in menu.name)
#         is_korean_ingredients = any('\uac00' <= char <= '\ud7a3' for char in menu.ingredients)

#         new_menu = menu.name
#         new_ingredients = menu.ingredients

#         if not is_korean_menu:
#             new_menu = await translate_to_korean_llm(menu.name)
#         if not is_korean_ingredients:
#             new_ingredients = await translate_to_korean_llm(menu.ingredients)

#         translated_menus.append(Menu(name=new_menu, ingredients=new_ingredients))
#     return translated_menus
# ===== 변경 전 코드 끝 =====

# ===== 변경 후 코드 (병렬 번역) =====
async def translate_menus_to_korean(menus: List[Menu]) -> List[Menu]:
    # 병렬 번역: 모든 번역 작업을 동시에 실행
    async def translate_single_menu(menu: Menu) -> Menu:
        is_korean_menu = any('\uac00' <= char <= '\ud7a3' for char in menu.name)
        is_korean_ingredients = any('\uac00' <= char <= '\ud7a3' for char in menu.ingredients)

        # 번역이 필요한 경우에만 비동기 작업 생성
        name_task = translate_to_korean_llm(menu.name) if not is_korean_menu else None
        ingredients_task = translate_to_korean_llm(menu.ingredients) if not is_korean_ingredients else None

        # 필요한 번역 작업만 병렬 실행
        tasks = []
        if name_task:
            tasks.append(name_task)
        if ingredients_task:
            tasks.append(ingredients_task)

        if tasks:
            results = await asyncio.gather(*tasks)
            result_idx = 0
            new_menu = results[result_idx] if name_task else menu.name
            result_idx += 1 if name_task else 0
            new_ingredients = results[result_idx] if ingredients_task else menu.ingredients
        else:
            new_menu = menu.name
            new_ingredients = menu.ingredients

        return Menu(name=new_menu, ingredients=new_ingredients)

    # 모든 메뉴 번역을 병렬로 처리
    translated_menus = await asyncio.gather(*[translate_single_menu(menu) for menu in menus])
    return translated_menus
# ===== 변경 후 코드 끝 =====

# --- Helper function to extract text from PDF ---
def extract_text_from_pdf(file_content: bytes) -> List[str]:
    try:
        start_time = time.time()
        print(f"[PERF] Starting PDF to image conversion...")

        # pdftoppm 경로 지정 for ec2
        # TODO: 로컬 서버에서 주석 처리 필요
        conversion_start = time.time()
        # images = convert_from_bytes(file_content, poppler_path="/usr/bin") # pdftoppm 위치
        images = convert_from_bytes(file_content) # pdftoppm 위치
        conversion_time = time.time() - conversion_start
        print(f"[PERF] PDF to image conversion took {conversion_time:.2f}s for {len(images)} pages")

        text_list = []
        ocr_start = time.time()
        for i, image in enumerate(images):
            page_ocr_start = time.time()
            # Use Tesseract to do OCR on the image.
            text = pytesseract.image_to_string(image, lang='kor+eng')
            page_ocr_time = time.time() - page_ocr_start
            # OCR 변동성 확인을 위한 로깅
            text_preview = text[:100].replace('\n', ' ') if len(text) > 100 else text.replace('\n', ' ')
            print(f"[PERF] OCR for page {i+1} took {page_ocr_time:.2f}s (length: {len(text)} chars)")
            print(f"[DEBUG] OCR preview: {text_preview}...")
            text_list.append(text)

        total_ocr_time = time.time() - ocr_start
        total_time = time.time() - start_time
        print(f"[PERF] Total OCR time: {total_ocr_time:.2f}s")
        print(f"[PERF] Total PDF extraction time: {total_time:.2f}s")

        return text_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text from PDF using OCR: {e}")

# --- Helper function to extract text from an image ---
def extract_text_from_image(file_content: bytes) -> List[str]:
    try:
        start_time = time.time()
        print(f"[PERF] Starting image OCR...")

        image = Image.open(io.BytesIO(file_content))
        image = image.convert("RGB")  # OCR용으로 안전하게 변환

        ocr_start = time.time()
        # Use Tesseract to do OCR on the image.
        text = pytesseract.image_to_string(image, lang='kor+eng')
        ocr_time = time.time() - ocr_start

        # OCR 변동성 확인을 위한 로깅
        text_preview = text[:100].replace('\n', ' ') if len(text) > 100 else text.replace('\n', ' ')
        total_time = time.time() - start_time
        print(f"[PERF] Image OCR took {ocr_time:.2f}s (length: {len(text)} chars)")
        print(f"[DEBUG] OCR preview: {text_preview}...")
        print(f"[PERF] Total image extraction time: {total_time:.2f}s")

        return [text]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text from image using OCR: {e}")

# --- Helper function to generate menus from text ---
async def generate_menus_from_text(recipe_text: str) -> MenuResponse:
    start_time = time.time()

    if not recipe_text.strip():
        return MenuResponse(menus=[]) # Return empty if no text is provided

    menu_prompt = PromptTemplate(
        template="""Extract menus from the recipe text and respond in json format.

다음 레시피 텍스트에서 메뉴를 추출하여 JSON 형식으로 응답하세요.

중요 규칙:
1. 각 메뉴는 정확히 한 번만 포함하세요 (중복 제거)
2. "아이스"와 "핫"은 별도 메뉴로 분리하지 마세요 (예: "아이스 아메리카노", "핫 아메리카노" → "아메리카노" 하나로)
3. 사이즈 차이(Tall, Grande, Venti 등)는 별도 메뉴로 분리하지 마세요
4. 명확하게 구분되는 메뉴만 추출하세요
5. 모든 내용은 한국어여야 합니다

Return json in this format:
{{
  "menus": [
    {{"name": "메뉴이름", "ingredients": "재료1, 재료2, 재료3"}},
    {{"name": "메뉴이름2", "ingredients": "재료1, 재료2"}}
  ]
}}

Example json response:
{{
  "menus": [
    {{"name": "아샷추", "ingredients": "아이스티 300ml, 샷"}},
    {{"name": "카라멜 마끼아또", "ingredients": "카라멜소스 30g, 설탕시럽 2P, 스팀우유 250ml"}},
    {{"name": "헤이즐넛아메리카노", "ingredients": "샷, 헤이즐넛시럽 2P"}}
  ]
}}

레시피 텍스트:
---
{recipe_text}
---

json response:
""",
        input_variables=["recipe_text"],
    )

    # Chain for parsing only
    parsing_chain = menu_prompt | llm | (lambda x: x.content) | RunnableLambda(parse_llm_response_to_menus)

    llm_start = time.time()
    parsed_menus = await parsing_chain.ainvoke({"recipe_text": recipe_text})
    llm_time = time.time() - llm_start

    print(f"[PERF] LLM parsing took {llm_time:.2f}s, parsed {len(parsed_menus)} menus")
    print(f"[DEBUG] Parsed menu names: {[menu.name for menu in parsed_menus[:3]]}..." if len(parsed_menus) > 3 else f"[DEBUG] Parsed menu names: {[menu.name for menu in parsed_menus]}")

    # Apply translation separately
    translation_start = time.time()
    translated_menus = await translate_menus_to_korean(parsed_menus)
    translation_time = time.time() - translation_start

    total_time = time.time() - start_time
    print(f"[PERF] Translation took {translation_time:.2f}s, result: {len(translated_menus)} menus")
    print(f"[DEBUG] Final menu names: {[menu.name for menu in translated_menus[:3]]}..." if len(translated_menus) > 3 else f"[DEBUG] Final menu names: {[menu.name for menu in translated_menus]}")
    print(f"[PERF] Total page processing took {total_time:.2f}s")

    return MenuResponse(menus=translated_menus)

# ===== 변경 전 코드 (순차 처리) =====
# 성능 비교를 위해 아래 주석을 해제하고 "변경 후 코드" 부분을 주석 처리하면
# 변경 전 순차 처리 방식으로 실행됩니다.
#
# async def generate_menus_from_text_util(recipe_text_list: List[str]) -> MenuResponse:
#     # recipe_text_list를 순회하며 각 텍스트를 개별적으로 처리 후 결과를 합침
#     start_time = time.time()
#     print(f"\n{'='*60}")
#     print(f"[PERF] Starting SEQUENTIAL processing of {len(recipe_text_list)} pages")
#     print(f"{'='*60}\n")

#     all_menus = []
#     # 해당 text가 배열에서 몇 번째인지 출력
#     for i, recipe_text in enumerate(recipe_text_list):
#         print(f"[PERF] Processing page {i+1}/{len(recipe_text_list)}...")
#         menu_response = await generate_menus_from_text(recipe_text)
#         all_menus.extend(menu_response.menus)
#         print(f"[PERF] Page {i+1} generated {len(menu_response.menus)} menus")

#     total_time = time.time() - start_time
#     print(f"\n{'='*60}")
#     print(f"[PERF] SUMMARY (SEQUENTIAL):")
#     print(f"[PERF] Total pages: {len(recipe_text_list)}")
#     print(f"[PERF] Total menus generated: {len(all_menus)}")
#     print(f"[PERF] Total time: {total_time:.2f}s")
#     print(f"{'='*60}\n")

#     return MenuResponse(menus=all_menus)
# ===== 변경 전 코드 끝 =====

# ===== 변경 후 코드 (병렬 처리) =====
async def generate_menus_from_text_util(recipe_text_list: List[str]) -> MenuResponse:
    start_time = time.time()

    # 단일 페이지는 순차 처리가 더 빠름 (병렬 오버헤드 방지)
    if len(recipe_text_list) == 1:
        print(f"\n{'='*60}")
        print(f"[PERF] Single page - using SEQUENTIAL processing")
        print(f"{'='*60}\n")

        menu_response = await generate_menus_from_text(recipe_text_list[0])
        total_time = time.time() - start_time

        print(f"\n{'='*60}")
        print(f"[PERF] SUMMARY (SEQUENTIAL - Single Page):")
        print(f"[PERF] Total menus generated: {len(menu_response.menus)}")
        print(f"[PERF] Total time: {total_time:.2f}s")
        print(f"{'='*60}\n")

        return menu_response

    # 다중 페이지는 병렬 처리로 성능 향상
    print(f"\n{'='*60}")
    print(f"[PERF] Starting PARALLEL processing of {len(recipe_text_list)} pages")
    print(f"{'='*60}\n")

    # 모든 페이지에 대해 병렬로 메뉴 생성 작업 실행
    tasks = [generate_menus_from_text(recipe_text) for recipe_text in recipe_text_list]
    parallel_start = time.time()
    results = await asyncio.gather(*tasks)
    parallel_time = time.time() - parallel_start

    # 결과 합치기
    all_menus = []
    for i, menu_response in enumerate(results):
        print(f"[PERF] Page {i+1} generated {len(menu_response.menus)} menus")
        all_menus.extend(menu_response.menus)

    total_time = time.time() - start_time
    avg_time_per_page = total_time / len(recipe_text_list) if recipe_text_list else 0

    print(f"\n{'='*60}")
    print(f"[PERF] SUMMARY (PARALLEL):")
    print(f"[PERF] Total pages: {len(recipe_text_list)}")
    print(f"[PERF] Total menus generated: {len(all_menus)}")
    print(f"[PERF] Parallel processing time: {parallel_time:.2f}s")
    print(f"[PERF] Total time: {total_time:.2f}s")
    print(f"[PERF] Average per page: {avg_time_per_page:.2f}s")
    print(f"[PERF] Estimated sequential time: {avg_time_per_page * len(recipe_text_list):.2f}s")
    print(f"[PERF] Speedup: {(avg_time_per_page * len(recipe_text_list)) / total_time:.2f}x")
    print(f"{'='*60}\n")

    return MenuResponse(menus=all_menus)
# ===== 변경 후 코드 끝 =====

# --- API Endpoints ---
@app.get("/")
def read_root():
    """Root endpoint to check if the server is running."""
    return {"status": "AI server is running"}

@app.post("/generate/menus", response_model=MenuResponse)
async def upload_recipe(file: UploadFile = File(...)):
    """Generate menus from an uploaded PDF or image file."""
    request_start = time.time()
    content_type = file.content_type
    print(f"\n{'#'*60}")
    print(f"[PERF] NEW REQUEST - File type: {content_type}")
    print(f"{'#'*60}\n")

    try:
        file_read_start = time.time()
        file_content = await file.read()
        file_read_time = time.time() - file_read_start
        file_size_mb = len(file_content) / (1024 * 1024)
        print(f"[PERF] File read took {file_read_time:.2f}s (size: {file_size_mb:.2f}MB)")

        text_list = []

        if content_type == "application/pdf":
            text_list = extract_text_from_pdf(file_content)
        elif content_type and content_type.startswith("image/"):
            text_list = extract_text_from_image(file_content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a PDF or an image.")

        print(f"[PERF] Extracted {len(text_list)} page(s)")

        result = await generate_menus_from_text_util(text_list)

        total_request_time = time.time() - request_start
        print(f"\n{'#'*60}")
        print(f"[PERF] TOTAL REQUEST TIME: {total_request_time:.2f}s")
        print(f"[PERF] Total menus in response: {len(result.menus)}")
        print(f"{'#'*60}\n")

        return result

    except HTTPException as e:
        raise e
    except Exception as e:
        # Log the full error for debugging
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process file and generate menus: {e}")

# To run this server:
# 1. Make sure Ollama is running (e.g., 'ollama serve')
# 2. Make sure you have a model pulled (e.g., 'ollama pull llama3')
# 3. Run the FastAPI app: 'uvicorn src.main:app --reload --port 8000'
