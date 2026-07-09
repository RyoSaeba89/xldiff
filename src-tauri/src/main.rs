// XLDiff — enveloppe de bureau Tauri.
// L'application web (dist/) est embarquée telle quelle dans le binaire ;
// tout le traitement reste dans la webview, aucun accès réseau.
//
// La fenêtre est construite ici (et non dans tauri.conf.json) pour pouvoir
// intercepter les téléchargements : l'export .xlsx passe par une boîte de
// dialogue Windows « Enregistrer sous » au lieu du dossier Téléchargements.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::webview::DownloadEvent;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("XLDiff — Comparateur de fichiers Excel")
            .inner_size(1280.0, 860.0)
            .min_inner_size(900.0, 600.0)
            .center()
            // Laisse le glisser-déposer HTML atteindre les zones de dépôt
            .disable_drag_drop_handler()
            .on_download(|_webview, event| {
                if let DownloadEvent::Requested { destination, .. } = event {
                    // Nom proposé par la webview (ex. xldiff_20260709_1432.xlsx)
                    let suggestion = destination
                        .file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_else(|| String::from("xldiff.xlsx"));
                    match rfd::FileDialog::new()
                        .set_title("Enregistrer le fichier Excel")
                        .set_file_name(&suggestion)
                        .add_filter("Classeur Excel", &["xlsx"])
                        .save_file()
                    {
                        Some(path) => {
                            *destination = path;
                            true
                        }
                        // L'utilisateur a annulé : on abandonne le téléchargement
                        None => false,
                    }
                } else {
                    true
                }
            })
            .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("échec du lancement de XLDiff");
}
