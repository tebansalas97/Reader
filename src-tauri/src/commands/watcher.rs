use crate::error::{AppError, AppResult, ErrorKind};
use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebouncedEvent, Debouncer, RecommendedCache};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize)]
pub struct FsChanged {
    pub path: String,
    pub kind: &'static str,
}

pub fn normalise(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

#[derive(Default)]
pub struct Registry {
    paths: Mutex<HashSet<String>>,
}

impl Registry {
    pub fn add(&self, path: String) -> bool {
        self.paths.lock().unwrap().insert(normalise(&path))
    }

    pub fn remove(&self, path: &str) -> bool {
        self.paths.lock().unwrap().remove(&normalise(path))
    }

    pub fn contains(&self, path: &str) -> bool {
        self.paths.lock().unwrap().contains(&normalise(path))
    }
}

pub struct WatcherState {
    pub registry: Registry,
    debouncer: Mutex<Option<Debouncer<notify::RecommendedWatcher, RecommendedCache>>>,
    dirs: Mutex<HashSet<String>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            registry: Registry::default(),
            debouncer: Mutex::new(None),
            dirs: Mutex::new(HashSet::new()),
        }
    }
}

fn kind_of(event: &DebouncedEvent) -> &'static str {
    if event.kind.is_remove() {
        "removed"
    } else {
        "modified"
    }
}

fn ensure_debouncer(app: &AppHandle, state: &WatcherState) -> AppResult<()> {
    let mut guard = state.debouncer.lock().unwrap();
    if guard.is_some() {
        return Ok(());
    }
    let handle = app.clone();
    let debouncer = new_debouncer(Duration::from_millis(200), None, move |result| {
        let Ok(events) = result else { return };
        let Some(state) = handle.try_state::<WatcherState>() else {
            return;
        };
        for event in events {
            let kind = kind_of(&event);
            for path in &event.paths {
                let raw = path.to_string_lossy().replace('\\', "/");
                if state.registry.contains(&raw) {
                    let _ = handle.emit("fs:changed", FsChanged { path: raw, kind });
                }
            }
        }
    })
    .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?;
    *guard = Some(debouncer);
    Ok(())
}

#[tauri::command]
pub fn watch(app: AppHandle, state: State<'_, WatcherState>, path: String) -> AppResult<()> {
    ensure_debouncer(&app, &state)?;
    state.registry.add(path.clone());
    let file = PathBuf::from(&path);
    let dir = file.parent().map(Path::to_path_buf).ok_or_else(|| {
        AppError::new(ErrorKind::InvalidPath, "La ruta no tiene carpeta padre").with_path(&path)
    })?;
    let key = normalise(&dir.to_string_lossy());
    if !state.dirs.lock().unwrap().insert(key) {
        return Ok(());
    }
    let mut guard = state.debouncer.lock().unwrap();
    if let Some(d) = guard.as_mut() {
        d.watch(&dir, RecursiveMode::NonRecursive)
            .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()).with_path(&path))?;
    }
    Ok(())
}

#[tauri::command]
pub fn unwatch(state: State<'_, WatcherState>, path: String) -> AppResult<()> {
    state.registry.remove(&path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_tracks_and_untracks() {
        let r = Registry::default();
        assert!(r.add("C:/a.md".into()));
        assert!(!r.add("C:/a.md".into()));
        assert!(r.contains("C:/a.md"));
        assert!(r.remove("C:/a.md"));
        assert!(!r.contains("C:/a.md"));
        assert!(!r.remove("C:/a.md"));
    }

    #[test]
    fn registry_normalises_separators() {
        let r = Registry::default();
        r.add("C:\\docs\\a.md".into());
        assert!(r.contains("C:/docs/a.md"));
    }

    #[test]
    fn registry_is_case_insensitive_on_windows_paths() {
        let r = Registry::default();
        r.add("C:/Docs/A.md".into());
        assert!(r.contains("c:/docs/a.md"));
    }
}
