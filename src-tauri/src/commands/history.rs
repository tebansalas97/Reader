use crate::error::{AppError, AppResult, ErrorKind};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const MAX_SNAPSHOTS: usize = 40;
const MIN_GAP_MS: u64 = 30_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: String,
    pub saved_ms: u64,
    pub bytes: u64,
}

pub fn folder_key(path: &str) -> String {
    let normalised = path.replace('\\', "/").to_lowercase();
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in normalised.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    let stem = Path::new(&normalised)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("documento");
    let safe: String = stem
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(32)
        .collect();
    let label = if safe.is_empty() {
        "documento".to_string()
    } else {
        safe
    };
    format!("{label}-{hash:016x}")
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn history_root(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?;
    Ok(dir.join("history"))
}

pub fn read_snapshots(dir: &Path) -> Vec<Snapshot> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut list: Vec<Snapshot> = entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            let id = name.strip_suffix(".md")?.to_string();
            let saved_ms = id.parse::<u64>().ok()?;
            let bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);
            Some(Snapshot {
                id,
                saved_ms,
                bytes,
            })
        })
        .collect();
    list.sort_by_key(|a| std::cmp::Reverse(a.saved_ms));
    list
}

fn prune(dir: &Path) {
    let list = read_snapshots(dir);
    for old in list.iter().skip(MAX_SNAPSHOTS) {
        let _ = fs::remove_file(dir.join(format!("{}.md", old.id)));
    }
}

pub fn should_snapshot(list: &[Snapshot], now: u64) -> bool {
    match list.first() {
        None => true,
        Some(last) => now.saturating_sub(last.saved_ms) >= MIN_GAP_MS,
    }
}

#[tauri::command]
pub fn snapshot_document(app: AppHandle, path: String, text: String) -> AppResult<()> {
    let dir = history_root(&app)?.join(folder_key(&path));
    fs::create_dir_all(&dir).map_err(|e| AppError::from_io(e, &dir.to_string_lossy()))?;
    let now = now_ms();
    if !should_snapshot(&read_snapshots(&dir), now) {
        return Ok(());
    }
    let file = dir.join(format!("{now}.md"));
    fs::write(&file, text).map_err(|e| AppError::from_io(e, &file.to_string_lossy()))?;
    prune(&dir);
    Ok(())
}

#[tauri::command]
pub fn list_snapshots(app: AppHandle, path: String) -> AppResult<Vec<Snapshot>> {
    Ok(read_snapshots(&history_root(&app)?.join(folder_key(&path))))
}

#[tauri::command]
pub fn read_snapshot(app: AppHandle, path: String, id: String) -> AppResult<String> {
    if !id.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::new(ErrorKind::InvalidPath, "Identificador no válido"));
    }
    let file = history_root(&app)?
        .join(folder_key(&path))
        .join(format!("{id}.md"));
    fs::read_to_string(&file).map_err(|e| AppError::from_io(e, &file.to_string_lossy()))
}

#[tauri::command]
pub fn clear_snapshots(app: AppHandle, path: String) -> AppResult<()> {
    let dir = history_root(&app)?.join(folder_key(&path));
    if !dir.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&dir).map_err(|e| AppError::from_io(e, &dir.to_string_lossy()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn folder_key_is_stable_for_the_same_path() {
        assert_eq!(folder_key("C:/docs/a.md"), folder_key("C:/docs/a.md"));
    }

    #[test]
    fn folder_key_ignores_separator_and_case() {
        assert_eq!(folder_key("C:/Docs/A.md"), folder_key(r"c:\docs\a.md"));
    }

    #[test]
    fn folder_key_differs_between_documents() {
        assert_ne!(folder_key("C:/docs/a.md"), folder_key("C:/docs/b.md"));
    }

    #[test]
    fn folder_key_starts_with_a_readable_name() {
        assert!(folder_key("C:/docs/mi-nota.md").starts_with("mi-nota-"));
    }

    #[test]
    fn folder_key_survives_a_name_with_accents() {
        let key = folder_key("C:/docs/canción.md");
        assert!(key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    }

    #[test]
    fn snapshots_come_back_newest_first() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("100.md"), "viejo").unwrap();
        fs::write(d.path().join("300.md"), "nuevo").unwrap();
        fs::write(d.path().join("200.md"), "medio").unwrap();
        let list = read_snapshots(d.path());
        assert_eq!(
            list.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec!["300", "200", "100"]
        );
    }

    #[test]
    fn non_snapshot_files_are_ignored() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("100.md"), "ok").unwrap();
        fs::write(d.path().join("notas.txt"), "no").unwrap();
        fs::write(d.path().join("abc.md"), "no").unwrap();
        assert_eq!(read_snapshots(d.path()).len(), 1);
    }

    #[test]
    fn missing_folder_yields_no_snapshots() {
        assert!(read_snapshots(Path::new("Z:/no/existe")).is_empty());
    }

    #[test]
    fn the_first_save_always_snapshots() {
        assert!(should_snapshot(&[], 1000));
    }

    #[test]
    fn a_save_right_after_another_does_not_snapshot() {
        let list = vec![Snapshot {
            id: "1000".into(),
            saved_ms: 1000,
            bytes: 3,
        }];
        assert!(!should_snapshot(&list, 2000));
    }

    #[test]
    fn a_save_after_the_gap_snapshots() {
        let list = vec![Snapshot {
            id: "1000".into(),
            saved_ms: 1000,
            bytes: 3,
        }];
        assert!(should_snapshot(&list, 1000 + MIN_GAP_MS));
    }
}
