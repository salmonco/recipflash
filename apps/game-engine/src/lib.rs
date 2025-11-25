use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn greet() {
    log("Hello from Rust!");
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ingredient {
    pub name: String,
}

impl Ingredient {
    pub fn new(name: String) -> Self {
        Ingredient { name }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Menu {
    pub name: String,
    pub ingredients: Vec<Ingredient>,
}

impl Menu {
    pub fn new(name: String, ingredients: Vec<Ingredient>) -> Self {
        Menu { name, ingredients }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Recipe {
    pub name: String,
    pub menus: Vec<Menu>,
}

impl Recipe {
    pub fn new(name: String, menus: Vec<Menu>) -> Self {
        Recipe { name, menus }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Point {
    pub x: u32,
    pub y: u32,
}

impl Point {
    pub fn new(x: u32, y: u32) -> Self {
        Point { x, y }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Wall {
    pub start: Point,
    pub end: Point,
}

impl Wall {
    pub fn new(start: Point, end: Point) -> Self {
        Wall { start, end }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Location {
    pub name: String,
    pub position: Point,
    pub ingredients: Vec<Ingredient>,
}

impl Location {
    pub fn new(name: String, position: Point, ingredients: Vec<Ingredient>) -> Self {
        Location { name, position, ingredients }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Map {
    pub width: u32,
    pub height: u32,
    pub walls: Vec<Wall>,
    pub locations: Vec<Location>,
    pub loaded_recipe: Option<Recipe>,
}

impl Map {
    pub fn new(width: u32, height: u32) -> Self {
        Map {
            width,
            height,
            walls: Vec::new(),
            locations: Vec::new(),
            loaded_recipe: None,
        }
    }

    pub fn add_wall(&mut self, wall: Wall) {
        self.walls.push(wall);
    }

    pub fn add_location(&mut self, location: Location) {
        self.locations.push(location);
    }

    pub fn load_recipe(&mut self, recipe: Recipe) {
        self.loaded_recipe = Some(recipe);
    }
}

#[wasm_bindgen]
pub fn simulate_movement(map: &Map) {
    log(&format!("Simulating movement on map with dimensions {}x{}", map.width, map.height));
    // TODO: Implement actual movement simulation logic here
}





