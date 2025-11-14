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
from typing import List
from langchain_core.runnables import RunnableLambda, Runnable
from dotenv import load_dotenv

load_dotenv()

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Recipflash AI Server",
    description="AI server for recipe-related tasks using LangChain, including PDF and image processing.",
)

# --- LLM Setup ---
# Comment out the Ollama model to switch to OpenAI
# llm = ChatOllama(model="llama3")

# Uncomment the following line to use OpenAI
llm = ChatOpenAI(model="gpt-3.5-turbo")

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

                            if "name" in processed_item and "ingredients" in processed_item:
                                menus_list.append(Menu(name=processed_item["name"], ingredients=processed_item["ingredients"]))
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

                if "name" in processed_item and "ingredients" in processed_item:
                    menus_list.append(Menu(name=processed_item["name"], ingredients=processed_item["ingredients"]))
        except json.JSONDecodeError:
            pass

    if menus_list:
        return menus_list

    # Strategy 3: Fallback - try to parse the entire output as a single JSON array
    # This is less robust if there's conversational text, but good as a last resort
    try:
        data = json.loads(llm_output.strip())
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    processed_item = {}
                    for key, value in item.items():
                        new_key = field_renames.get(key.lower(), key)
                        processed_item[new_key] = value

                    if "name" in processed_item and "ingredients" in processed_item:
                        menus_list.append(Menu(name=processed_item["name"], ingredients=processed_item["ingredients"]))
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
    # Use the same LLM instance for translation
    chain = translation_prompt | llm | (lambda x: x.content)
    translated_text = await chain.ainvoke({"text": text})
    return translated_text.strip()

async def translate_menus_to_korean(menus: List[Menu]) -> List[Menu]:
    translated_menus = []
    for menu in menus:
        # Simple language detection (can be improved with a library like `langdetect`)
        # For now, assume if it's not obviously Korean, translate it.
        # This is a very basic check and might not be accurate for all cases.
        is_korean_menu = any('\uac00' <= char <= '\ud7a3' for char in menu.name)
        is_korean_ingredients = any('\uac00' <= char <= '\ud7a3' for char in menu.ingredients)

        new_menu = menu.name
        new_ingredients = menu.ingredients

        if not is_korean_menu:
            new_menu = await translate_to_korean_llm(menu.name)
        if not is_korean_ingredients:
            new_ingredients = await translate_to_korean_llm(menu.ingredients)

        translated_menus.append(Menu(name=new_menu, ingredients=new_ingredients))
    return translated_menus

# --- Helper function to extract text from PDF ---
def extract_text_from_pdf(file_content: bytes) -> List[str]:
    try:
        images = convert_from_bytes(file_content)
        text_list = []
        for image in images:
            # Use Tesseract to do OCR on the image.
            text = pytesseract.image_to_string(image, lang='kor+eng')
            text_list.append(text)
        return text_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text from PDF using OCR: {e}")

# --- Helper function to extract text from an image ---
def extract_text_from_image(file_content: bytes) -> List[str]:
    try:
        image = Image.open(io.BytesIO(file_content))
        # Use Tesseract to do OCR on the image.
        text = pytesseract.image_to_string(image, lang='kor+eng')
        return [text]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text from image using OCR: {e}")

# --- Helper function to generate menus from text ---
async def generate_menus_from_text(recipe_text: str) -> MenuResponse:
    if not recipe_text.strip():
        return MenuResponse(menus=[]) # Return empty if no text is provided

    menu_prompt = PromptTemplate(
        template="""다음 레시피 텍스트에서 메뉴 JSON 배열을 생성하세요. 모든 내용은 한국어여야 합니다.
각 메뉴는 'name'과 'ingredients' 키를 가진 JSON 객체여야 합니다.
예시:
[
  {{"name": "아샷추", "ingredients": "아이스티 300ml, 샷"}},
  {{"name": "카라멜 마끼아또", "ingredients": "카라멜소스 30g, 설탕시럽 2P, 스팀우유 250ml"}},
  {{"name": "헤이즐넛아메리카노", "ingredients": "샷, 헤이즐넛시럽 2P"}},
  {{"name": "레몬에이드", "ingredients": "사이다 가득(250ml), 레몬퓨레 1.5P + 슈가시럽 1P + 레몬슬라이스 + 애플민트"}},
  {{"name": "플레인요거트스무디", "ingredients": "우유 200ml, 요거트파우더 6래들 + 슈가시럽 1P"}},
]
레시피 텍스트:
---
{recipe_text}
---
JSON 응답:
""",
        input_variables=["recipe_text"],
    )

    # Chain for parsing only
    parsing_chain = menu_prompt | llm | (lambda x: x.content) | RunnableLambda(parse_llm_response_to_menus)

    parsed_menus = await parsing_chain.ainvoke({"recipe_text": recipe_text})

    print(f"parsed_menus: {parsed_menus}")  # Debugging output

    # Apply translation separately
    translated_menus = await translate_menus_to_korean(parsed_menus)

    print(f"translated_menus: {translated_menus}")  # Debugging output

    return MenuResponse(menus=translated_menus)

async def generate_menus_from_text_util(recipe_text_list: List[str]) -> MenuResponse:
    # recipe_text_list를 순회하며 각 텍스트를 개별적으로 처리 후 결과를 합침
    all_menus = []
    # 해당 text가 배열에서 몇 번째인지 출력
    for i, recipe_text in enumerate(recipe_text_list):
        print(f"recipe_text[{i}]: {recipe_text}")  # Debugging output

        menu_response = await generate_menus_from_text(recipe_text)
        all_menus.extend(menu_response.menus)

    return MenuResponse(menus=all_menus)

# --- API Endpoints ---
@app.get("/")
def read_root():
    """Root endpoint to check if the server is running."""
    return {"status": "AI server is running"}

@app.post("/generate/menus", response_model=MenuResponse)
async def upload_recipe(file: UploadFile = File(...)):
    """Generate menus from an uploaded PDF or image file."""
    content_type = file.content_type
    print(f"Received file with content type: {content_type}")

    try:
        file_content = await file.read()
        text_list = []

        if content_type == "application/pdf":
            text_list = extract_text_from_pdf(file_content)
        elif content_type and content_type.startswith("image/"):
            text_list = extract_text_from_image(file_content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a PDF or an image.")

        print(f"Extracted page/image count: {len(text_list)}")  # Debugging output

        return await generate_menus_from_text_util(text_list)

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
