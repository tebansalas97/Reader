use crate::error::{AppError, AppResult, ErrorKind};
use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebouncedEvent, Debouncer, RecommendedCache};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
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

const OWN_WRITE_WINDOW: Duration = Duration::from_millis(2000);

fn own_writes() -> &'static Mutex<HashMap<String, Instant>> {
    static WRITES: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
    WRITES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn note_own_write(path: &str) {
    let mut guard = own_writes().lock().unwrap();
    guard.retain(|_, at| at.elapsed() < OWN_WRITE_WINDOW);
    guard.insert(normalise(path), Instant::now());
}

pub fn was_own_write(path: &str) -> bool {
    let guard = own_writes().lock().unwrap();
    guard
        .get(&normalise(path))
        .is_some_and(|at| at.elapsed() < OWN_WRITE_WINDOW)
}

pub fn merge_batch(entries: Vec<(String, &'static str)>) -> Vec<(String, &'static str)> {
    let mut order: Vec<String> = Vec::new();
    let mut kinds: HashMap<String, &'static str> = HashMap::new();
    for (path, kind) in entries {
        match kinds.get(&path) {
            Some(known) => {
                if *known == "removed" && kind == "modified" {
                    kinds.insert(path, "modified");
                }
            }
            None => {
                order.push(path.clone());
                kinds.insert(path, kind);
            }
        }
    }
    order.into_iter().map(|path| (path.clone(), kinds[&path])).collect()
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
        let mut seen: Vec<(String, &'static str)> = Vec::new();
        for event in events {
            let kind = kind_of(&event);
            for path in &event.paths {
                let raw = path.to_string_lossy().replace('\\', "/");
                if state.registry.contains(&raw) && !was_own_write(&raw) {
                    seen.push((raw, kind));
                }
            }
        }
        for (path, kind) in merge_batch(seen) {
            let _ = handle.emit("fs:changed", FsChanged { path, kind });
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
    fn a_write_of_ours_is_ignored_for_a_moment() {
        note_own_write("C:/notas/a.pdf");
        assert!(was_own_write("C:/notas/a.pdf"));
        assert!(was_own_write("c:\\notas\\a.pdf"));
    }

    #[test]
    fn a_write_of_someone_else_is_not_ignored() {
        note_own_write("C:/notas/a.pdf");
        assert!(!was_own_write("C:/notas/b.pdf"));
    }

    #[test]
    fn a_replaced_file_counts_as_changed_not_as_deleted() {
        let batch = vec![
            ("C:/a.pdf".to_string(), "removed"),
            ("C:/a.pdf".to_string(), "modified"),
        ];
        assert_eq!(merge_batch(batch), vec![("C:/a.pdf".to_string(), "modified")]);
    }

    #[test]
    fn a_file_that_was_really_deleted_stays_deleted() {
        let batch = vec![("C:/a.pdf".to_string(), "removed")];
        assert_eq!(merge_batch(batch), vec![("C:/a.pdf".to_string(), "removed")]);
    }

    #[test]
    fn each_path_is_reported_once_per_batch() {
        let batch = vec![
            ("C:/a.pdf".to_string(), "modified"),
            ("C:/b.pdf".to_string(), "modified"),
            ("C:/a.pdf".to_string(), "modified"),
        ];
        assert_eq!(merge_batch(batch).len(), 2);
    }

    #[test]
    fn keeps_the_order_the_events_arrived_in() {
        let batch = vec![
            ("C:/b.pdf".to_string(), "modified"),
            ("C:/a.pdf".to_string(), "removed"),
        ];
        let merged = merge_batch(batch);
        assert_eq!(merged[0].0, "C:/b.pdf");
        assert_eq!(merged[1].0, "C:/a.pdf");
    }

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
