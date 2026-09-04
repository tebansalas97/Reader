use crate::commands::store::{config_file, read_json_or_default, write_json};
use crate::error::AppResult;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

const FILE: &str = "recent.json";
const MAX: usize = 20;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentItem {
    pub path: String,
    pub opened_ms: u64,
}

fn key(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

pub fn merge(mut list: Vec<RecentItem>, path: String, now_ms: u64) -> Vec<RecentItem> {
    let k = key(&path);
    list.retain(|i| key(&i.path) != k);
    list.insert(
        0,
        RecentItem {
            path: path.replace('\\', "/"),
            opened_ms: now_ms,
        },
    );
    list.truncate(MAX);
    list
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn get_recent(app: AppHandle) -> AppResult<Vec<RecentItem>> {
    Ok(read_json_or_default(&config_file(&app, FILE)?, Vec::new))
}

#[tauri::command]
pub fn push_recent(app: AppHandle, path: String) -> AppResult<Vec<RecentItem>> {
    let file = config_file(&app, FILE)?;
    let list = merge(read_json_or_default(&file, Vec::new), path, now_ms());
    write_json(&file, &list)?;
    Ok(list)
}

#[tauri::command]
pub fn clear_recent(app: AppHandle) -> AppResult<()> {
    write_json(&config_file(&app, FILE)?, &Vec::<RecentItem>::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(path: &str, ms: u64) -> RecentItem {
        RecentItem {
            path: path.into(),
            opened_ms: ms,
        }
    }

    #[test]
    fn new_path_goes_first() {
        let list = merge(vec![item("a.md", 1)], "b.md".into(), 2);
        assert_eq!(list[0].path, "b.md");
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn existing_path_moves_to_front_without_duplicating() {
        let list = merge(vec![item("a.md", 1), item("b.md", 2)], "a.md".into(), 3);
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].path, "a.md");
        assert_eq!(list[0].opened_ms, 3);
    }

    #[test]
    fn same_path_with_different_separators_is_one_entry() {
        let list = merge(vec![item("C:/d/a.md", 1)], r"C:\d\a.md".into(), 2);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].path, "C:/d/a.md");
    }

    #[test]
    fn list_is_capped_at_twenty() {
        let mut list: Vec<RecentItem> = (0..20).map(|i| item(&format!("{i}.md"), i)).collect();
        list = merge(list, "new.md".into(), 99);
        assert_eq!(list.len(), 20);
        assert_eq!(list[0].path, "new.md");
    }
}
