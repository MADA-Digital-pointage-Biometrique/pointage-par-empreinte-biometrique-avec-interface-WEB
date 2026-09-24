#!/usr/bin/env python3
"""
CLI R307 appelé par PHP (SdkReader -> exec)
PHP passe toujours par api/biometric.php -> SdkReader -> exec python r307_cli.py

Usage:
  python r307_cli.py --port COM3 --baud 57600 --action enroll --id 12
  python r307_cli.py --port COM3 --action search
  python r307_cli.py --port COM3 --action delete --id 12
  python r307_cli.py --port COM3 --action empty
  python r307_cli.py --port COM3 --action status
  python r307_cli.py --port COM3 --action count
  python r307_cli.py --list-ports
  python r307_cli.py --auto-port
  python r307_cli.py --mock --action enroll --id 5

Sortie JSON sur stdout pour PHP :
  {"ok":true, "page_id":12, "score":87}
  {"ok":false, "message":"..."}
"""
import argparse
import json
import os
import sys
from datetime import datetime


def _mode_path():
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mode.json')


def _trigger_path():
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), '.mode_trigger')


def read_mode():
    """Lit mode.json. Retourne le mode par défaut (pointage) si absent/corrompu."""
    path = _mode_path()
    default = {"mode": "pointage", "target_id": None, "updated_at": None, "updated_by": None}
    if not os.path.exists(path):
        return default
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        default.update(data)
        return default
    except Exception:
        return default


def write_mode(mode, target_id=None, updated_by=None):
    """Écrit mode.json de façon atomique (tmp + os.replace) et notifie via .mode_trigger.

    L'écriture atomique évite qu'un autre processus (r307_cli enroll, r307_service)
    lise un fichier à moitié écrit pendant le remplacement.
    """
    if mode not in ('enrolement', 'pointage'):
        raise ValueError("mode invalide (enrolement|pointage)")
    data = {
        "mode": mode,
        "target_id": int(target_id) if (mode == 'enrolement' and target_id) else None,
        "updated_at": datetime.now().astimezone().isoformat(timespec='seconds'),
        "updated_by": updated_by,
    }
    path = _mode_path()
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f)
    os.replace(tmp, path)
    # .mode_trigger : simple marqueur dont on met à jour la date de modification,
    # pour qu'un watcher (JS/PHP) détecte le changement sans reparser mode.json à chaque poll.
    try:
        open(_trigger_path(), 'a', encoding='utf-8').close()
        os.utime(_trigger_path(), None)
    except Exception:
        pass
    return data


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--port', default='COM5')
    p.add_argument('--baud', type=int, default=57600)
    p.add_argument('--timeout', type=int, default=15)
    p.add_argument('--password', default='00000000')
    p.add_argument('--action', choices=['enroll','search','verify','delete','empty','status','count','template','enroll1','enroll2','probe','set-mode','get-mode'], default='status')
    p.add_argument('--id', type=int, default=0, dest='page_id')
    p.add_argument('--list-ports', action='store_true')
    p.add_argument('--auto-port', action='store_true')
    p.add_argument('--mock', action='store_true', help='Simule sans matériel (pour dev sans R307)')
    p.add_argument('--mode', choices=['enrolement', 'pointage'], help="Mode à appliquer (set-mode)")
    p.add_argument('--target-id', type=int, default=None, dest='target_id', help="Employé cible en mode enrolement (set-mode)")
    p.add_argument('--updated-by', type=int, default=None, dest='updated_by', help="id_utilisateur à l'origine du changement (set-mode)")
    args = p.parse_args()

    # Gestion du mode (enrolement/pointage) : ne nécessite pas le matériel,
    # traitée avant --mock et avant l'import du driver.
    if args.action == 'get-mode':
        print(json.dumps({"ok": True, **read_mode()}))
        return

    if args.action == 'set-mode':
        if not args.mode:
            print(json.dumps({"ok": False, "message": "--mode requis (enrolement|pointage)"}))
            return
        if args.mode == 'enrolement' and (not args.target_id or args.target_id < 1):
            print(json.dumps({"ok": False, "message": "--target-id requis (>=1) pour passer en mode enrolement"}))
            return
        data = write_mode(args.mode, args.target_id, args.updated_by)
        print(json.dumps({"ok": True, **data}))
        return

    if args.mock:
        if args.action == 'enroll':
            print(json.dumps({"ok": True, "page_id": args.page_id, "mock": True, "message": f"Enrôlement simulé page {args.page_id}"}))
        elif args.action in ('enroll1', 'enroll2'):
            print(json.dumps({"ok": True, "mock": True, "step": 1 if args.action == 'enroll1' else 2, "page_id": args.page_id, "message": "Capture simulée"}))
        elif args.action == 'probe':
            print(json.dumps({"ok": True, "mock": True, "page_id": args.page_id, "present": args.page_id % 2 == 0}))
        elif args.action in ('search','verify'):
            print(json.dumps({"ok": False, "message": "Aucune empreinte (mock)", "mock": True}))
        elif args.action == 'delete':
            print(json.dumps({"ok": True, "mock": True}))
        elif args.action == 'status':
            print(json.dumps({"ok": True, "mock": True, "count": 0}))
        elif args.action == 'template':
            print(json.dumps({"ok": True, "mock": True, "page_id": args.page_id, "size": 512, "template": "ab" * 256}))
        else:
            print(json.dumps({"ok": True, "mock": True}))
        return

    try:
        from r307_driver import R307
    except ImportError as e:
        print(json.dumps({"ok": False, "message": f"pyserial manquant: {e}. Installez: pip install pyserial"}))
        sys.exit(0)

    if args.list_ports:
        print(json.dumps({"ok": True, "ports": R307.list_ports()}))
        return
    if args.auto_port:
        print(json.dumps({"ok": True, "port": R307.auto_detect()}))
        return

    port = args.port
    if port == 'auto':
        port = R307.auto_detect() or 'COM3'

    # Vérifie Mode Opératoire du Terminal (python/mode.json) : enrolement sans cible = idle
    if args.action in ('enroll', 'enroll1', 'enroll2'):
        mj = read_mode()
        if mj.get('mode') != 'enrolement' or not mj.get('target_id'):
            print(json.dumps({"ok": False, "message": "R307 en attente : mode Pointage ou enrolement sans employé (sélectionne cible)", "mode": mj.get('mode')}))
            sys.exit(0)
        # F3 : le slot (--id) alloué par PHP/SdkReader fait foi, pas target_id
        # (un ancien code écrasait le slot par target_id, corrompant le mapping
        # dès que slot != id_employe, ex. id > 999 → échec injustifié).

    # timeout/password depuis config (SdkReader)
    pwd = args.password
    try:
        if pwd.lower().startswith('0x'): pwd = int(pwd, 16)
        else: pwd = int(pwd, 16) if len(pwd)==8 and all(c in '0123456789abcdefABCDEF' for c in pwd) else int(pwd)
    except: pwd = 0x00000000
    r = R307(port=port, baud=args.baud, timeout=args.timeout, pwd=pwd)
    try:
        r.open()
        if args.action == 'enroll':
            # page_id = id_employe (1..1000). R307 page 0..999 — refuse au lieu de borner silencieusement
            if args.page_id < 1 or args.page_id > 999:
                print(json.dumps({"ok": False, "message": f"slot invalide {args.page_id} (1..999) — capacité R307 atteinte"}))
                sys.exit(0)
            pid = int(args.page_id)
            r.enroll(pid)
            print(json.dumps({"ok": True, "page_id": pid, "message": f"Enrôlé page {pid} sur {port}"}))
        elif args.action in ('search','verify'):
            res = r.verify_once()
            if res:
                page_id, score = res
                print(json.dumps({"ok": True, "page_id": page_id, "score": score}))
            else:
                print(json.dumps({"ok": False, "message": "Aucune correspondance"}))
        elif args.action == 'delete':
            r.delete(args.page_id)
            print(json.dumps({"ok": True, "message": f"Supprimé page {args.page_id}"}))
        elif args.action == 'empty':
            r.empty()
            print(json.dumps({"ok": True, "message": "Base R307 vidée"}))
        elif args.action in ('status','count'):
            cnt = r.template_num()
            print(json.dumps({"ok": True, "count": cnt, "port": port}))
        elif args.action == 'template':
            # F5 : télécharge le gabarit stocké (LOAD page -> UP_CHAR buffer)
            if args.page_id < 1 or args.page_id > 999:
                print(json.dumps({"ok": False, "message": f"slot invalide {args.page_id} (1..999)"}))
                sys.exit(0)
            r.load(int(args.page_id), 1)
            blob = r.up_char(1)
            print(json.dumps({"ok": True, "page_id": int(args.page_id), "size": len(blob), "template": blob.hex()}))
        elif args.action == 'enroll1':
            # Étape 1/2 : 1re capture -> CharBuffer1 (le buffer survit entre appels)
            r.enroll_capture1()
            print(json.dumps({"ok": True, "step": 1, "message": "Capture 1 validée — retirez puis reposez le doigt"}))
        elif args.action == 'probe':
            # B3 : vérifie qu'une page est occupée (LOAD) sans rien télécharger.
            if args.page_id < 0 or args.page_id > 999:
                print(json.dumps({"ok": False, "message": f"slot invalide {args.page_id} (0..999)"}))
                sys.exit(0)
            try:
                r.load(int(args.page_id), 1)
                print(json.dumps({"ok": True, "page_id": int(args.page_id), "present": True}))
            except Exception as e:
                print(json.dumps({"ok": True, "page_id": int(args.page_id), "present": False, "message": str(e)}))
        elif args.action == 'enroll2':
            # Étape 2/2 : retrait + 2e capture + fusion + stockage page
            if args.page_id < 1 or args.page_id > 999:
                print(json.dumps({"ok": False, "message": f"slot invalide {args.page_id} (1..999)"}))
                sys.exit(0)
            pid = int(args.page_id)
            r.enroll_capture2(pid)
            print(json.dumps({"ok": True, "step": 2, "page_id": pid, "message": f"Capture 2 validée — empreinte stockée page {pid}"}))
        else:
            print(json.dumps({"ok": False, "message": "Action inconnue"}))
    except Exception as e:
        print(json.dumps({"ok": False, "message": str(e), "port": port}))
        sys.exit(0)
    finally:
        try: r.close()
        except: pass

if __name__ == '__main__':
    main()