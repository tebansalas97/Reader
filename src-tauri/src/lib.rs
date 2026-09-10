mod commands;
mod error;

use tauri::{Emitter, Manager};

fn cli_export(app: &tauri::AppHandle) -> Option<String> {
    use tauri_plugin_cli::CliExt;
    let matches = app.cli().matches().ok()?;
    let arg = matches.args.get("export-pdf")?;
    match &arg.value {
        serde_json::Value::String(path) => Some(path.clone()),
        _ => None,
    }
}

fn cli_paths(app: &tauri::AppHandle) -> Vec<String> {
    use tauri_plugin_cli::CliExt;
    let Ok(matches) = app.cli().matches() else {
        return Vec::new();
    };
    let Some(arg) = matches.args.get("paths") else {
        return Vec::new();
    };
    match &arg.value {
        serde_json::Value::String(s) => vec![s.clone()],
        serde_json::Value::Array(a) => a
            .iter()
            .filter_map(|v| v.as_str().map(str::to_owned))
            .collect(),
        _ => Vec::new(),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let files: Vec<String> = argv
                .into_iter()
                .skip(1)
                .filter(|a| !a.starts_with('-'))
                .collect();
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            let _ = app.emit("app:open-paths", files);
        }))
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(commands::watcher::WatcherState::default())
        .setup(|app| {
            let paths = cli_paths(&app.handle().clone());
            app.manage(commands::StartupPaths(std::sync::Mutex::new(paths)));
            let target = cli_export(&app.handle().clone());
            app.manage(commands::export::ExportTarget(std::sync::Mutex::new(target)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_text,
            commands::fs::write_text,
            commands::fs::read_bytes,
            commands::fs::write_bytes,
            commands::export::export_pdf,
            commands::export::startup_export,
            commands::stamps::get_stamps,
            commands::stamps::set_stamps,
            commands::fs::read_bytes_raw,
            commands::fs::write_bytes_raw,
            commands::fs::exists,
            commands::dir::list_dir,
            commands::search::search_folder,
            commands::history::snapshot_document,
            commands::history::list_snapshots,
            commands::history::read_snapshot,
            commands::history::clear_snapshots,
            commands::watcher::watch,
            commands::watcher::unwatch,
            commands::prefs::get_prefs,
            commands::prefs::set_prefs,
            commands::recent::get_recent,
            commands::recent::push_recent,
            commands::recent::clear_recent,
            commands::shell::open_external,
            commands::assets::save_asset,
            commands::assets::allow_asset_dir,
            commands::startup_paths,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
