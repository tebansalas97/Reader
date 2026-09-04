use crate::error::{AppError, AppResult, ErrorKind};
use serde::Serialize;
use std::fs;
use std::path::Path;

const IGNORED: [&str; 6] = [
    "node_modules",
    ".git",
    "target",
    "dist",
    ".svelte-kit",
    "$RECYCLE.BIN",
];
const EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];
const MAX_DEPTH: u8 = 4;
const MAX_ENTRIES: usize = 2000;

#[derive(Debug, Serialize)]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<Entry>>,
}

fn is_visible_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.') || IGNORED.contains(&name)
}

pub fn list_dir_sync(path: &str, depth: u8) -> AppResult<Vec<Entry>> {
    walk(Path::new(path), depth.clamp(1, MAX_DEPTH))
}

fn walk(dir: &Path, depth: u8) -> AppResult<Vec<Entry>> {
    let read = fs::read_dir(dir).map_err(|e| AppError::from_io(e, &dir.to_string_lossy()))?;
    let mut dirs: Vec<Entry> = Vec::new();
    let mut files: Vec<Entry> = Vec::new();
    for item in read.flatten() {
        if dirs.len() + files.len() >= MAX_ENTRIES {
            break;
        }
        let name = item.file_name().to_string_lossy().into_owned();
        if is_hidden(&name) {
            continue;
        }
        let p = item.path();
        let is_dir = item.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if is_dir {
            let children = if depth > 1 { walk(&p, depth - 1).ok() } else { None };
            dirs.push(Entry {
                name,
                path: p.to_string_lossy().replace('\\', "/"),
                is_dir: true,
                children,
            });
        } else if is_visible_file(&p) {
            files.push(Entry {
                name,
                path: p.to_string_lossy().replace('\\', "/"),
                is_dir: false,
                children: None,
            });
        }
    }
    dirs.sort_by_key(|a| a.name.to_lowercase());
    files.sort_by_key(|a| a.name.to_lowercase());
    dirs.extend(files);
    Ok(dirs)
}

#[tauri::command]
pub async fn list_dir(path: String, depth: u8) -> AppResult<Vec<Entry>> {
    tauri::async_runtime::spawn_blocking(move || list_dir_sync(&path, depth))
        .await
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn fixture() -> tempfile::TempDir {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("b.md"), "").unwrap();
        fs::write(d.path().join("a.md"), "").unwrap();
        fs::write(d.path().join("notes.txt"), "").unwrap();
        fs::write(d.path().join("photo.png"), "").unwrap();
        fs::create_dir(d.path().join("sub")).unwrap();
        fs::write(d.path().join("sub").join("c.markdown"), "").unwrap();
        fs::create_dir(d.path().join("node_modules")).unwrap();
        d
    }

    #[test]
    fn lists_markdown_and_text_only() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 1).unwrap();
        let names: Vec<&str> = e.iter().map(|x| x.name.as_str()).collect();
        assert!(names.contains(&"a.md"));
        assert!(names.contains(&"notes.txt"));
        assert!(!names.contains(&"photo.png"));
    }

    #[test]
    fn directories_come_first_then_alphabetical() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 1).unwrap();
        let names: Vec<&str> = e.iter().map(|x| x.name.as_str()).collect();
        assert_eq!(names, vec!["sub", "a.md", "b.md", "notes.txt"]);
    }

    #[test]
    fn skips_ignored_directories() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 2).unwrap();
        assert!(e.iter().all(|x| x.name != "node_modules"));
    }

    #[test]
    fn depth_one_leaves_children_none() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 1).unwrap();
        let sub = e.iter().find(|x| x.name == "sub").unwrap();
        assert!(sub.children.is_none());
    }

    #[test]
    fn depth_two_fills_children() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 2).unwrap();
        let sub = e.iter().find(|x| x.name == "sub").unwrap();
        assert_eq!(sub.children.as_ref().unwrap()[0].name, "c.markdown");
    }

    #[test]
    fn depth_is_capped() {
        let d = fixture();
        assert!(list_dir_sync(d.path().to_str().unwrap(), 200).is_ok());
    }

    #[test]
    fn paths_use_forward_slashes() {
        let d = fixture();
        let e = list_dir_sync(d.path().to_str().unwrap(), 1).unwrap();
        assert!(e.iter().all(|x| !x.path.contains('\\')));
    }

    #[test]
    fn missing_directory_is_not_found() {
        let e = list_dir_sync("Z:/definitely/not/here", 1).unwrap_err();
        assert_eq!(e.kind, ErrorKind::NotFound);
    }
}
