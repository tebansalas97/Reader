use crate::error::{AppError, AppResult, ErrorKind};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub fn config_file(app: &AppHandle, name: &str) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?;
    Ok(dir.join(name))
}

pub fn read_json_or_default<T: DeserializeOwned>(path: &Path, fallback: impl Fn() -> T) -> T {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<T>(&s).ok())
        .unwrap_or_else(fallback)
}

pub fn write_json<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| AppError::from_io(e, &dir.to_string_lossy()))?;
    }
    let data =
        serde_json::to_vec_pretty(value).map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?;
    fs::write(path, data).map_err(|e| AppError::from_io(e, &path.to_string_lossy()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_file_returns_default() {
        let d = tempfile::tempdir().unwrap();
        let v: serde_json::Value = read_json_or_default(&d.path().join("prefs.json"), || json!({}));
        assert_eq!(v, json!({}));
    }

    #[test]
    fn corrupt_file_returns_default_instead_of_failing() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("prefs.json");
        std::fs::write(&p, "{ this is not json").unwrap();
        let v: serde_json::Value = read_json_or_default(&p, || json!({ "theme": "dark" }));
        assert_eq!(v, json!({ "theme": "dark" }));
    }

    #[test]
    fn write_creates_parent_directories_and_roundtrips() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("nested").join("prefs.json");
        write_json(&p, &json!({ "a": 1 })).unwrap();
        let v: serde_json::Value = read_json_or_default(&p, || json!({}));
        assert_eq!(v, json!({ "a": 1 }));
    }
}
