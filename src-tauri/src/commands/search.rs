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
const MAX_DEPTH: u8 = 8;
const MAX_HITS: usize = 500;
const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024;
const CONTEXT: usize = 90;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub name: String,
    pub line: usize,
    pub column: usize,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchOutcome {
    pub hits: Vec<SearchHit>,
    pub truncated: bool,
    pub files_scanned: usize,
}

pub fn fold(value: &str) -> String {
    value
        .chars()
        .flat_map(|c| c.to_lowercase())
        .map(|c| match c {
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' => 'o',
            'ú' | 'ü' => 'u',
            'ñ' => 'n',
            other => other,
        })
        .collect()
}

pub fn find_in_line(line: &str, needle: &str, case_sensitive: bool) -> Option<usize> {
    if case_sensitive {
        return line.find(needle);
    }
    let haystack = fold(line);
    let target = fold(needle);
    let byte = haystack.find(&target)?;
    Some(haystack[..byte].chars().count())
}

pub fn excerpt(line: &str, column: usize) -> String {
    let characters: Vec<char> = line.chars().collect();
    if characters.len() <= CONTEXT {
        return line.trim_end().to_string();
    }
    let start = column.saturating_sub(CONTEXT / 3);
    let end = (start + CONTEXT).min(characters.len());
    let mut text: String = characters[start..end].iter().collect();
    if start > 0 {
        text.insert_str(0, "… ");
    }
    if end < characters.len() {
        text.push_str(" …");
    }
    text.trim_end().to_string()
}

fn is_searchable(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn scan(
    dir: &Path,
    needle: &str,
    case_sensitive: bool,
    depth: u8,
    hits: &mut Vec<SearchHit>,
    files: &mut usize,
) {
    if depth == 0 || hits.len() >= MAX_HITS {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        if hits.len() >= MAX_HITS {
            return;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || IGNORED.contains(&name.as_str()) {
            continue;
        }
        let path = entry.path();
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        if is_dir {
            scan(&path, needle, case_sensitive, depth - 1, hits, files);
            continue;
        }
        if !is_searchable(&path) {
            continue;
        }
        if fs::metadata(&path).map(|m| m.len()).unwrap_or(0) > MAX_FILE_BYTES {
            continue;
        }
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        *files += 1;
        for (index, line) in content.lines().enumerate() {
            if hits.len() >= MAX_HITS {
                return;
            }
            let Some(column) = find_in_line(line, needle, case_sensitive) else {
                continue;
            };
            hits.push(SearchHit {
                path: path.to_string_lossy().replace('\\', "/"),
                name: name.clone(),
                line: index,
                column,
                text: excerpt(line, column),
            });
        }
    }
}

pub fn search_sync(root: &str, query: &str, case_sensitive: bool) -> AppResult<SearchOutcome> {
    let needle = query.trim();
    if needle.is_empty() {
        return Ok(SearchOutcome {
            hits: Vec::new(),
            truncated: false,
            files_scanned: 0,
        });
    }
    let dir = Path::new(root);
    if !dir.is_dir() {
        return Err(AppError::new(ErrorKind::NotFound, "La carpeta no existe").with_path(root));
    }
    let mut hits = Vec::new();
    let mut files = 0;
    scan(dir, needle, case_sensitive, MAX_DEPTH, &mut hits, &mut files);
    let truncated = hits.len() >= MAX_HITS;
    Ok(SearchOutcome {
        hits,
        truncated,
        files_scanned: files,
    })
}

#[tauri::command]
pub async fn search_folder(
    path: String,
    query: String,
    case_sensitive: bool,
) -> AppResult<SearchOutcome> {
    tauri::async_runtime::spawn_blocking(move || search_sync(&path, &query, case_sensitive))
        .await
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn fixture() -> tempfile::TempDir {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("uno.md"), "hola mundo\nsegunda linea\n").unwrap();
        fs::write(d.path().join("dos.md"), "otro MUNDO aqui\n").unwrap();
        fs::write(d.path().join("nota.txt"), "mundo en texto\n").unwrap();
        fs::write(d.path().join("imagen.png"), "mundo binario\n").unwrap();
        fs::create_dir(d.path().join("sub")).unwrap();
        fs::write(d.path().join("sub").join("tres.md"), "mundo anidado\n").unwrap();
        fs::create_dir(d.path().join("node_modules")).unwrap();
        fs::write(
            d.path().join("node_modules").join("x.md"),
            "mundo ignorado\n",
        )
        .unwrap();
        d
    }

    #[test]
    fn finds_matches_across_files_and_folders() {
        let d = fixture();
        let out = search_sync(d.path().to_str().unwrap(), "mundo", false).unwrap();
        let names: Vec<&str> = out.hits.iter().map(|h| h.name.as_str()).collect();
        assert!(names.contains(&"uno.md"));
        assert!(names.contains(&"dos.md"));
        assert!(names.contains(&"tres.md"));
        assert!(names.contains(&"nota.txt"));
    }

    #[test]
    fn skips_ignored_folders_and_other_extensions() {
        let d = fixture();
        let out = search_sync(d.path().to_str().unwrap(), "mundo", false).unwrap();
        assert!(out.hits.iter().all(|h| h.name != "x.md"));
        assert!(out.hits.iter().all(|h| h.name != "imagen.png"));
    }

    #[test]
    fn reports_zero_based_line_and_column() {
        let d = fixture();
        let out = search_sync(d.path().to_str().unwrap(), "segunda", false).unwrap();
        assert_eq!(out.hits.len(), 1);
        assert_eq!(out.hits[0].line, 1);
        assert_eq!(out.hits[0].column, 0);
    }

    #[test]
    fn case_sensitive_search_respects_case() {
        let d = fixture();
        let out = search_sync(d.path().to_str().unwrap(), "MUNDO", true).unwrap();
        assert_eq!(out.hits.len(), 1);
        assert_eq!(out.hits[0].name, "dos.md");
    }

    #[test]
    fn empty_query_returns_nothing() {
        let d = fixture();
        let out = search_sync(d.path().to_str().unwrap(), "   ", false).unwrap();
        assert!(out.hits.is_empty());
        assert_eq!(out.files_scanned, 0);
    }

    #[test]
    fn missing_folder_is_not_found() {
        let e = search_sync("Z:/no/existe", "x", false).unwrap_err();
        assert_eq!(e.kind, ErrorKind::NotFound);
    }

    #[test]
    fn paths_use_forward_slashes() {
        let d = fixture();
        let out = search_sync(d.path().to_str().unwrap(), "mundo", false).unwrap();
        assert!(out.hits.iter().all(|h| !h.path.contains('\\')));
    }

    #[test]
    fn fold_removes_accents_and_case() {
        assert_eq!(fold("CANCIÓN"), "cancion");
        assert_eq!(fold("Ñandú"), "nandu");
    }

    #[test]
    fn accent_insensitive_search_matches() {
        let d = tempfile::tempdir().unwrap();
        fs::write(d.path().join("a.md"), "una canción bonita\n").unwrap();
        let out = search_sync(d.path().to_str().unwrap(), "cancion", false).unwrap();
        assert_eq!(out.hits.len(), 1);
    }

    #[test]
    fn excerpt_keeps_short_lines_whole() {
        assert_eq!(excerpt("linea corta", 0), "linea corta");
    }

    #[test]
    fn excerpt_trims_long_lines() {
        let long = "x".repeat(400);
        let text = excerpt(&long, 200);
        assert!(text.chars().count() < 120);
        assert!(text.starts_with('…'));
    }

    #[test]
    fn find_in_line_reports_character_column() {
        assert_eq!(find_in_line("canción bonita", "bonita", false), Some(8));
    }
}
