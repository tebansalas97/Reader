use crate::error::{AppError, AppResult, ErrorKind};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineEnding {
    Lf,
    Crlf,
}

#[derive(Debug, Serialize)]
pub struct TextFile {
    pub text: String,
    pub modified_ms: u64,
    pub line_ending: LineEnding,
}

fn validate(path: &str) -> AppResult<PathBuf> {
    if path.trim().is_empty() {
        return Err(AppError::new(ErrorKind::InvalidPath, "Ruta vacía"));
    }
    Ok(PathBuf::from(path))
}

fn modified_ms_of(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn read_text_sync(path: &str) -> AppResult<TextFile> {
    let p = validate(path)?;
    let bytes = fs::read(&p).map_err(|e| AppError::from_io(e, path))?;
    let body = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF][..]).unwrap_or(&bytes);
    let raw = std::str::from_utf8(body).map_err(|_| {
        AppError::new(ErrorKind::NotUtf8, "El archivo no es UTF-8").with_path(path)
    })?;
    let line_ending = if raw.contains("\r\n") {
        LineEnding::Crlf
    } else {
        LineEnding::Lf
    };
    let text = if line_ending == LineEnding::Crlf {
        raw.replace("\r\n", "\n")
    } else {
        raw.to_owned()
    };
    Ok(TextFile {
        text,
        modified_ms: modified_ms_of(&p),
        line_ending,
    })
}

pub fn write_text_sync(path: &str, text: &str, line_ending: LineEnding) -> AppResult<u64> {
    let p = validate(path)?;
    let data = match line_ending {
        LineEnding::Lf => text.to_owned(),
        LineEnding::Crlf => text.replace('\n', "\r\n"),
    };
    let dir = p
        .parent()
        .filter(|d| !d.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let mut tmp = tempfile::Builder::new()
        .prefix(".reader-")
        .suffix(".tmp")
        .tempfile_in(&dir)
        .map_err(|e| AppError::from_io(e, path))?;
    tmp.write_all(data.as_bytes())
        .map_err(|e| AppError::from_io(e, path))?;
    tmp.flush().map_err(|e| AppError::from_io(e, path))?;
    tmp.persist(&p)
        .map_err(|e| AppError::from_io(e.error, path))?;
    Ok(modified_ms_of(&p))
}

#[tauri::command]
pub async fn read_text(path: String) -> AppResult<TextFile> {
    tauri::async_runtime::spawn_blocking(move || read_text_sync(&path))
        .await
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}

#[tauri::command]
pub async fn write_text(path: String, text: String, line_ending: LineEnding) -> AppResult<u64> {
    tauri::async_runtime::spawn_blocking(move || write_text_sync(&path, &text, line_ending))
        .await
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}

#[tauri::command]
pub async fn read_bytes(path: String) -> AppResult<Vec<u8>> {
    tauri::async_runtime::spawn_blocking(move || {
        fs::read(&path).map_err(|e| AppError::from_io(e, &path))
    })
    .await
    .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}

pub fn write_bytes_sync(path: &str, bytes: &[u8]) -> AppResult<u64> {
    let p = validate(path)?;
    let dir = p
        .parent()
        .filter(|d| !d.as_os_str().is_empty())
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let mut tmp = tempfile::Builder::new()
        .prefix(".reader-")
        .suffix(".tmp")
        .tempfile_in(&dir)
        .map_err(|e| AppError::from_io(e, path))?;
    tmp.write_all(bytes).map_err(|e| AppError::from_io(e, path))?;
    tmp.flush().map_err(|e| AppError::from_io(e, path))?;
    tmp.persist(&p)
        .map_err(|e| AppError::from_io(e.error, path))?;
    Ok(modified_ms_of(&p))
}

#[tauri::command]
pub async fn write_bytes(path: String, bytes: Vec<u8>) -> AppResult<u64> {
    tauri::async_runtime::spawn_blocking(move || write_bytes_sync(&path, &bytes))
        .await
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))?
}

#[tauri::command]
pub async fn exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn tmp() -> tempfile::TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn reads_lf_file_and_reports_lf() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        fs::write(&p, "hola\nmundo\n").unwrap();
        let f = read_text_sync(p.to_str().unwrap()).unwrap();
        assert_eq!(f.text, "hola\nmundo\n");
        assert_eq!(f.line_ending, LineEnding::Lf);
        assert!(f.modified_ms > 0);
    }

    #[test]
    fn reads_crlf_file_normalises_and_reports_crlf() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        fs::write(&p, "hola\r\nmundo\r\n").unwrap();
        let f = read_text_sync(p.to_str().unwrap()).unwrap();
        assert_eq!(f.text, "hola\nmundo\n");
        assert_eq!(f.line_ending, LineEnding::Crlf);
    }

    #[test]
    fn strips_utf8_bom() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        fs::write(&p, b"\xEF\xBB\xBF# T\n").unwrap();
        let f = read_text_sync(p.to_str().unwrap()).unwrap();
        assert_eq!(f.text, "# T\n");
    }

    #[test]
    fn rejects_non_utf8() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        fs::write(&p, [0xff, 0xfe, 0x00, 0x41]).unwrap();
        let e = read_text_sync(p.to_str().unwrap()).unwrap_err();
        assert_eq!(e.kind, ErrorKind::NotUtf8);
    }

    #[test]
    fn missing_file_is_not_found() {
        let dir = tmp();
        let p = dir.path().join("nope.md");
        let e = read_text_sync(p.to_str().unwrap()).unwrap_err();
        assert_eq!(e.kind, ErrorKind::NotFound);
        assert_eq!(e.path.as_deref(), Some(p.to_str().unwrap()));
    }

    #[test]
    fn writes_with_crlf_when_requested_and_leaves_no_temp() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        write_text_sync(p.to_str().unwrap(), "a\nb", LineEnding::Crlf).unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"a\r\nb");
        let names: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names.len(), 1);
    }

    #[test]
    fn writes_lf_untouched() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        write_text_sync(p.to_str().unwrap(), "a\nb", LineEnding::Lf).unwrap();
        assert_eq!(fs::read(&p).unwrap(), b"a\nb");
    }

    #[test]
    fn write_returns_modified_ms_matching_read() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        let m = write_text_sync(p.to_str().unwrap(), "x", LineEnding::Lf).unwrap();
        let f = read_text_sync(p.to_str().unwrap()).unwrap();
        assert_eq!(m, f.modified_ms);
    }

    #[test]
    fn write_overwrites_existing_content() {
        let dir = tmp();
        let p = dir.path().join("a.md");
        fs::write(&p, "viejo y mas largo").unwrap();
        write_text_sync(p.to_str().unwrap(), "nuevo", LineEnding::Lf).unwrap();
        assert_eq!(fs::read_to_string(&p).unwrap(), "nuevo");
    }

    #[test]
    fn writes_bytes_and_leaves_no_temp() {
        let dir = tmp();
        let p = dir.path().join("a.pdf");
        write_bytes_sync(p.to_str().unwrap(), &[1, 2, 3, 4]).unwrap();
        assert_eq!(fs::read(&p).unwrap(), vec![1, 2, 3, 4]);
        let names: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names.len(), 1);
    }

    #[test]
    fn writing_bytes_replaces_a_longer_file_whole() {
        let dir = tmp();
        let p = dir.path().join("a.pdf");
        fs::write(&p, vec![9u8; 500]).unwrap();
        write_bytes_sync(p.to_str().unwrap(), &[1, 2]).unwrap();
        assert_eq!(fs::read(&p).unwrap(), vec![1, 2]);
    }

    #[test]
    fn writing_bytes_returns_the_new_timestamp() {
        let dir = tmp();
        let p = dir.path().join("a.pdf");
        let stamp = write_bytes_sync(p.to_str().unwrap(), &[1]).unwrap();
        assert!(stamp > 0);
    }

    #[test]
    fn writing_bytes_to_an_empty_path_is_invalid() {
        let e = write_bytes_sync("", &[1]).unwrap_err();
        assert_eq!(e.kind, ErrorKind::InvalidPath);
    }

    #[test]
    fn empty_path_is_invalid() {
        let e = read_text_sync("").unwrap_err();
        assert_eq!(e.kind, ErrorKind::InvalidPath);
    }
}
