use serde::Serialize;
use std::io;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum ErrorKind {
    NotFound,
    PermissionDenied,
    NotUtf8,
    Io,
    InvalidPath,
}

#[derive(Debug, Serialize, thiserror::Error)]
#[error("{message}")]
pub struct AppError {
    pub kind: ErrorKind,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

impl AppError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            path: None,
        }
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = Some(path.into());
        self
    }

    pub fn from_io(err: io::Error, path: &str) -> Self {
        let kind = match err.kind() {
            io::ErrorKind::NotFound => ErrorKind::NotFound,
            io::ErrorKind::PermissionDenied => ErrorKind::PermissionDenied,
            _ => ErrorKind::Io,
        };
        Self::new(kind, err.to_string()).with_path(path)
    }
}

pub type AppResult<T> = Result<T, AppError>;
