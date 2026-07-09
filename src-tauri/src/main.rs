// XLDiff — enveloppe de bureau Tauri.
// L'application web (dist/) est embarquée telle quelle dans le binaire ;
// tout le traitement reste dans la webview, aucun accès réseau.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("échec du lancement de XLDiff");
}
