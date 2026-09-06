mod commands;
mod error;

use tauri::{Emitter, Manager};

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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_text,
            commands::fs::write_text,
            commands::fs::read_bytes,
            commands::fs::write_bytes,
            commands::fs::exists,
            commands::dir::list_dir,
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
