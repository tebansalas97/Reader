use crate::commands::store::{config_file, read_json_or_default, write_json};
use crate::error::AppResult;
use serde_json::{json, Value};
use tauri::AppHandle;

const FILE: &str = "prefs.json";

#[tauri::command]
pub fn get_prefs(app: AppHandle) -> AppResult<Value> {
    Ok(read_json_or_default(&config_file(&app, FILE)?, || json!({})))
}

#[tauri::command]
pub fn set_prefs(app: AppHandle, prefs: Value) -> AppResult<()> {
    write_json(&config_file(&app, FILE)?, &prefs)
}
