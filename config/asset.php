<?php
// Version anti-cache basée sur le CONTENU du fichier (hash court), jamais un
// timestamp : ne divulgue aucune horloge serveur (alerte ZAP "timestamp disclosure").
// Le hash change uniquement quand le fichier change → cache optimal.
function asset_ver(string $rel): string {
    static $cache = [];
    if (!isset($cache[$rel])) {
        $abs = __DIR__ . '/../frontend/' . ltrim($rel, '/');
        // $rel est déjà préfixé "assets/..." dans les pages → frontend/assets/...
        if (!is_file($abs)) {
            $abs = __DIR__ . '/../' . ltrim($rel, '/');
        }
        $cache[$rel] = is_file($abs) ? substr(md5_file($abs), 0, 8) : 'static';
    }
    return $cache[$rel];
}
