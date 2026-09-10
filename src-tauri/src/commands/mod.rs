pub mod assets;
pub mod dir;
pub mod fs;
pub mod history;
pub mod prefs;
pub mod recent;
pub mod search;
pub mod shell;
pub mod stamps;
pub mod store;
pub mod watcher;

pub struct StartupPaths(pub std::sync::Mutex<Vec<String>>);

#[tauri::command]
pub fn startup_paths(state: tauri::State<'_, StartupPaths>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}
