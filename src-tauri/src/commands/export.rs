use crate::error::{AppError, AppResult, ErrorKind};

pub struct ExportTarget(pub std::sync::Mutex<Option<String>>);

#[tauri::command]
pub fn startup_export(state: tauri::State<'_, ExportTarget>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg(windows)]
#[tauri::command]
pub async fn export_pdf(window: tauri::WebviewWindow, path: String) -> AppResult<()> {
    use std::sync::mpsc;
    use std::time::Duration;
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_7;
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING};

    let (tx, rx) = mpsc::channel::<Result<bool, String>>();
    let target = path.clone();

    window
        .with_webview(move |webview| {
            let sender = tx.clone();
            let started = (|| -> Result<(), String> {
                let core = unsafe { webview.controller().CoreWebView2() }
                    .map_err(|error| error.to_string())?;
                let printer: ICoreWebView2_7 = core.cast().map_err(|error| error.to_string())?;
                let file = HSTRING::from(target.as_str());
                let done = sender.clone();
                let handler = PrintToPdfCompletedHandler::create(Box::new(move |code, ok| {
                    let _ = done.send(Ok(code.is_ok() && ok));
                    Ok(())
                }));
                unsafe { printer.PrintToPdf(&file, None, &handler) }
                    .map_err(|error| error.to_string())
            })();

            if let Err(message) = started {
                let _ = sender.send(Err(message));
            }
        })
        .map_err(|error| AppError::new(ErrorKind::Io, error.to_string()))?;

    let outcome = tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(Duration::from_secs(120))
            .map_err(|_| "el navegador no respondio".to_string())?
    })
    .await
    .map_err(|error| AppError::new(ErrorKind::Io, error.to_string()))?;

    match outcome {
        Ok(true) => Ok(()),
        Ok(false) => Err(AppError::new(ErrorKind::Io, "no se pudo escribir el PDF").with_path(&path)),
        Err(message) => Err(AppError::new(ErrorKind::Io, message).with_path(&path)),
    }
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn export_pdf(_window: tauri::WebviewWindow, path: String) -> AppResult<()> {
    Err(AppError::new(ErrorKind::Io, "solo disponible en Windows").with_path(&path))
}
