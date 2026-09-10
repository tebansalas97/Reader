use crate::commands::store::{config_file, read_json_or_default, write_json};
use crate::error::AppResult;
use serde_json::{json, Value};
use tauri::AppHandle;

const FILE: &str = "stamps.json";

#[tauri::command]
pub fn get_stamps(app: AppHandle) -> AppResult<Value> {
    Ok(read_json_or_default(&config_file(&app, FILE)?, || json!([])))
}

#[tauri::command]
pub fn set_stamps(app: AppHandle, stamps: Value) -> AppResult<()> {
    write_json(&config_file(&app, FILE)?, &stamps)
}
