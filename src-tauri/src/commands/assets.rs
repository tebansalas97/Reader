use crate::error::{AppError, AppResult, ErrorKind};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub fn unique_asset_name(existing: &[String], desired: &str) -> String {
    let cleaned = desired.replace('\\', "/");
    let candidate = cleaned.rsplit('/').next().unwrap_or("archivo").trim();
    let base_name = if candidate.is_empty() || candidate == ".." || candidate == "." {
        "archivo"
    } else {
        candidate
    };
    if !existing.iter().any(|e| e == base_name) {
        return base_name.to_string();
    }
    let (stem, ext) = match base_name.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s.to_string(), format!(".{e}")),
        _ => (base_name.to_string(), String::new()),
    };
    let mut n = 1;
    loop {
        let next = format!("{stem}-{n}{ext}");
        if !existing.contains(&next) {
            return next;
        }
        n += 1;
    }
}

fn existing_names(dir: &Path) -> Vec<String> {
    fs::read_dir(dir)
        .map(|entries| {
            entries
                .flatten()
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
pub async fn save_asset(doc_path: String, file_name: String, bytes: Vec<u8>) -> AppResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let doc = PathBuf::from(&doc_path);
        let parent = doc.parent().ok_or_else(|| {
            AppError::new(ErrorKind::InvalidPath, "El documento no tiene carpeta")
                .with_path(&doc_path)
        })?;
        let assets = parent.join("assets");
        fs::create_dir_all(&assets).map_err(|e| AppError::from_io(e, &assets.to_string_lossy()))?;
        let name = unique_asset_name(&existing_names(&assets), &file_name);
        let target = assets.join(&name);
        fs::write(&target, &bytes).map_err(|e| AppError::from_io(e, &target.to_string_lossy()))?;
        Ok(format!("assets/{name}"))
    })
    .await
    .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}

#[tauri::command]
pub fn allow_asset_dir(app: AppHandle, path: String) -> AppResult<()> {
    app.asset_protocol_scope()
        .allow_directory(&path, true)
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()).with_path(&path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_the_name_when_it_is_free() {
        assert_eq!(unique_asset_name(&[], "a.png"), "a.png");
    }

    #[test]
    fn appends_a_counter_when_taken() {
        assert_eq!(unique_asset_name(&["a.png".into()], "a.png"), "a-1.png");
    }

    #[test]
    fn skips_over_several_collisions() {
        let existing = vec!["a.png".to_string(), "a-1.png".to_string()];
        assert_eq!(unique_asset_name(&existing, "a.png"), "a-2.png");
    }

    #[test]
    fn sanitises_path_separators_and_traversal() {
        assert_eq!(unique_asset_name(&[], "../../evil.png"), "evil.png");
        assert_eq!(unique_asset_name(&[], "sub/dir/x.png"), "x.png");
    }

    #[test]
    fn handles_a_name_without_an_extension() {
        assert_eq!(unique_asset_name(&["captura".into()], "captura"), "captura-1");
    }
}
