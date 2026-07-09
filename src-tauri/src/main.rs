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
    // Postes sans runtime WebView2 (certains Windows 10 / VDI) : message
    // clair au lieu d'un échec silencieux au premier appel de la webview.
    if tauri::webview_version().is_err() {
        rfd::MessageDialog::new()
            .set_level(rfd::MessageLevel::Error)
            .set_title("XLDiff — composant Windows manquant")
            .set_description(
                "XLDiff a besoin du composant Windows « Microsoft Edge WebView2 Runtime », \
                 introuvable sur ce poste.\n\nIl est normalement préinstallé avec Windows 10 et 11. \
                 Demandez au support informatique d'installer le « WebView2 Runtime Evergreen » \
                 de Microsoft, puis relancez XLDiff.",
            )
            .show();
        std::process::exit(1);
    }

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
