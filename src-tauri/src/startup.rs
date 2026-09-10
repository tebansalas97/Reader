pub const OPENABLE: [&str; 4] = ["md", "markdown", "txt", "pdf"];

pub fn looks_openable(argument: &str) -> bool {
    if argument.starts_with('-') {
        return false;
    }
    let lowered = argument.to_ascii_lowercase();
    OPENABLE
        .iter()
        .any(|extension| lowered.ends_with(&format!(".{extension}")))
}

pub fn paths_from_argv<I: IntoIterator<Item = String>>(args: I) -> Vec<String> {
    args.into_iter()
        .skip(1)
        .filter(|argument| looks_openable(argument))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn argv(list: &[&str]) -> Vec<String> {
        list.iter().map(|entry| (*entry).to_string()).collect()
    }

    #[test]
    fn toma_el_documento_que_viene_detras_del_ejecutable() {
        assert_eq!(paths_from_argv(argv(&["reader.exe", "a.md"])), vec!["a.md"]);
    }

    #[test]
    fn no_confunde_una_opcion_con_un_documento() {
        assert!(paths_from_argv(argv(&["reader.exe", "--user-data-dir=x"])).is_empty());
    }

    #[test]
    fn se_queda_con_el_documento_entre_opciones_de_otros() {
        let args = argv(&[
            "reader.exe",
            "--remote-debugging-port=9222",
            "C:/docs/prueba.pdf",
            "--user-data-dir=C:/temp/x",
        ]);
        assert_eq!(paths_from_argv(args), vec!["C:/docs/prueba.pdf"]);
    }

    #[test]
    fn acepta_varios_documentos() {
        let args = argv(&["reader.exe", "uno.md", "dos.pdf"]);
        assert_eq!(paths_from_argv(args), vec!["uno.md", "dos.pdf"]);
    }

    #[test]
    fn no_le_importan_las_mayusculas_de_la_extension() {
        assert_eq!(paths_from_argv(argv(&["reader.exe", "A.PDF"])), vec!["A.PDF"]);
    }

    #[test]
    fn deja_fuera_lo_que_no_sabe_abrir() {
        assert!(paths_from_argv(argv(&["reader.exe", "foto.png"])).is_empty());
    }

    #[test]
    fn no_devuelve_nada_sin_argumentos() {
        assert!(paths_from_argv(argv(&["reader.exe"])).is_empty());
    }
}
