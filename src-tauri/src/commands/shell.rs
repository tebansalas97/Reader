use crate::error::{AppError, AppResult, ErrorKind};
use tauri_plugin_opener::OpenerExt;

const SCHEMES: [&str; 3] = ["http://", "https://", "mailto:"];

pub fn is_allowed(url: &str) -> bool {
    let lower = url.to_lowercase();
    SCHEMES.iter().any(|s| lower.starts_with(s))
}

#[tauri::command]
pub fn open_external(app: tauri::AppHandle, url: String) -> AppResult<()> {
    if !is_allowed(&url) {
        return Err(AppError::new(
            ErrorKind::InvalidPath,
            "Esquema de URL no permitido",
        ));
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| AppError::new(ErrorKind::Io, e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_http_https_mailto() {
        assert!(is_allowed("https://example.com"));
        assert!(is_allowed("http://example.com"));
        assert!(is_allowed("mailto:a@b.com"));
    }

    #[test]
    fn rejects_dangerous_schemes() {
        assert!(!is_allowed("file:///C:/Windows/System32/cmd.exe"));
        assert!(!is_allowed("javascript:alert(1)"));
        assert!(!is_allowed("ms-settings:"));
        assert!(!is_allowed("evil-https://x"));
    }

    #[test]
    fn scheme_check_is_case_insensitive() {
        assert!(is_allowed("HTTPS://example.com"));
    }
}
