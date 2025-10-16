from fastapi import FastAPI, UploadFile, File, HTTPException
from langchain_ollama import ChatOllama
from langchain.prompts import PromptTemplate
from pydantic import BaseModel, Field
import PyPDF2
import io
import json
import re
from typing import List
from langchain_core.runnables import RunnableLambda, Runnable

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Recipflash AI Server",
    description="AI server for recipe-related tasks using LangChain and Ollama, including PDF processing.",
)

# --- Ollama and LangChain Setup ---
llm = ChatOllama(model="llama3")

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
                    if menus_list: # If we found valid menus, return them
                        return menus_list
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
                        flashcards_list.append(Flashcard(name=processed_item["name"], ingredients=processed_item["ingredients"]))
            if menus_list:
                return menus_list
    except json.JSONDecodeError:
        pass

    raise ValueError(f"Failed to extract and parse any valid flashcards from LLM output. Raw output: {llm_output}")

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
def extract_text_from_pdf(file_content: bytes) -> str:
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page_num in range(len(reader.pages)):
            text += reader.pages[page_num].extract_text() or ""
        return text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text from PDF: {e}")

# --- Helper function to generate menus from text ---
async def generate_menus_from_text_util(recipe_text: str) -> MenuResponse:
    print(f"recipe_text: {recipe_text}")  # Debugging output

    if not recipe_text.strip():
        raise HTTPException(status_code=400, detail="No text provided for menu generation.")

    menu_prompt = PromptTemplate(
        template="""다음 레시피 텍스트에서 메뉴 JSON 배열을 생성하세요. 모든 내용은 한국어여야 합니다.
각 메뉴는 'name'과 'ingredients' 키를 가진 JSON 객체여야 합니다.
예시:
[
  {{"name": "헛개리카노", "ingredients": "샷, 헛개시럽 2P"}},
  {{"name": "헤이즐넛아메리카노", "ingredients": "샷, 헤이즐넛시럽 2P"}},
  {{"name": "레몬에이드", "ingredients": "사이다 가득(250ml), 레몬퓨레 1.5P + 슈가시럽 1P + 레몬슬라이스 + 애플민트"}},
  {{"name": "자몽에이드", "ingredients": "사이다 가득(250ml), 자몽퓨레 1P + 자몽시럽 1P + 슈가시럽 1P + 자몽슬라이스 + 애플민트"}},
  {{"name": "플레인요거트스무디", "ingredients": "우유 200ml, 요거트파우더 6래들 + 슈가시럽 1P"}},
  {{"name": "딸기요거트스무디", "ingredients": "우유 150ml, 요거트파우더 3래들 + 가당딸기 150ml + 슈가시럽 1P"}},
  {{"name": "코코넛커피스무디", "ingredients": "블랜더(재료,얼음) → 믹싱 → 계량컵(식힌 샷) → 컵(부어줌) → 토핑 3번 20x가득 x 코코넛베이스 250ml + 코코넛칩 1래들  // 컵 바닥 식힌 샷 50ml 코코넛칩 1래들(약 5g)"}},
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

# --- API Endpoints ---

@app.get("/")
def read_root():
    """Root endpoint to check if the server is running."""
    return {"status": "AI server is running"}

@app.post("/generate/menus", response_model=MenuResponse)
async def generate_menus(file: UploadFile = File(...)):
    """Generate menus from an uploaded PDF recipe."""
    if not file.content_type == "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    try:
        file_content = await file.read()
        recipe_text = extract_text_from_pdf(file_content)

        if not recipe_text.strip():
            raise HTTPException(status_code=400, detail="No text found in the PDF.")

        return await generate_menus_from_text_util(recipe_text)

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF and generate menus: {e}")

# To run this server:
# 1. Make sure Ollama is running (e.g., 'ollama serve')
# 2. Make sure you have a model pulled (e.g., 'ollama pull llama3')
# 3. Run the FastAPI app: 'uvicorn src.main:app --reload --port 8000'
