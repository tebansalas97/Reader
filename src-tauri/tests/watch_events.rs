use notify::RecursiveMode;
use notify_debouncer_full::new_debouncer;
use std::io::Write;
use std::sync::mpsc;
use std::time::Duration;

#[test]
fn an_atomic_write_looks_like_a_deletion_to_the_watcher() {
    let dir = tempfile::tempdir().unwrap();
    let target = dir.path().join("doc.pdf");
    std::fs::write(&target, b"uno").unwrap();

    let (tx, rx) = mpsc::channel();
    let mut debouncer = new_debouncer(Duration::from_millis(200), None, move |result| {
        let _ = tx.send(result);
    })
    .unwrap();
    debouncer
        .watch(dir.path(), RecursiveMode::NonRecursive)
        .unwrap();
    std::thread::sleep(Duration::from_millis(300));

    let mut tmp = tempfile::Builder::new()
        .prefix(".reader-")
        .suffix(".tmp")
        .tempfile_in(dir.path())
        .unwrap();
    tmp.write_all(b"dos").unwrap();
    tmp.flush().unwrap();
    tmp.persist(&target).unwrap();

    std::thread::sleep(Duration::from_millis(1500));

    let mut removals = 0;
    while let Ok(Ok(events)) = rx.try_recv() {
        for event in events {
            if event.kind.is_remove() && event.paths.iter().any(|p| p == &target) {
                removals += 1;
            }
        }
    }

    assert!(
        removals > 0,
        "si esto falla, sobreescribir un archivo ya no parece un borrado y note_own_write podria sobrar"
    );
}
